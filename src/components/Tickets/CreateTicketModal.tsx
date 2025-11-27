import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, AlertCircle, CheckCircle, Paperclip, FileText, Image } from 'lucide-react';

interface CreateTicketModalProps {
  onClose: () => void;
}

interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

export function CreateTicketModal({ onClose }: CreateTicketModalProps) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-5 h-5 text-green-600" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600" />;
    } else if (fileType.includes('sheet') || fileType.includes('excel')) {
      return <FileText className="w-5 h-5 text-green-600" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    } else {
      return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const uploadFiles = async (): Promise<Attachment[]> => {
    if (selectedFiles.length === 0) return [];

    setUploading(true);
    const attachments: Attachment[] = [];

    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile?.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        attachments.push({
          name: file.name,
          path: fileName,
          size: file.size,
          type: file.type,
        });
      }
    } finally {
      setUploading(false);
    }

    return attachments;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!profile?.id) {
      setError('No se pudo identificar el usuario');
      return;
    }

    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    if (!description.trim()) {
      setError('La descripción es requerida');
      return;
    }

    if (!category.trim()) {
      setError('La categoría es requerida');
      return;
    }

    setLoading(true);

    try {
      // Subir archivos primero
      const attachments = await uploadFiles();

      // Crear el ticket con los archivos adjuntos
      const ticketData: any = {
        title: title.trim(),
        description: description.trim(),
        priority,
        category: category.trim(),
        status: 'open',
        created_by: profile.id,
        attachments: attachments.length > 0 ? attachments : [],
      };
      
      const { error: insertError } = await supabase.from('tickets').insert(ticketData);

      if (insertError) throw insertError;

      setSuccess(true);
    } catch (err) {
      console.error('Error creating ticket:', err);
      setError(err instanceof Error ? err.message : 'Error al crear el ticket');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Ticket Creado!</h3>
            <p className="text-gray-600 mb-6">
              Tu ticket ha sido enviado exitosamente. Nuestro equipo de soporte lo revisará y te contactará pronto.
            </p>
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Crear Ticket de Soporte</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título del Ticket <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumen breve del problema"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              required
            >
              <option value="">Selecciona una categoría</option>
              <option value="Técnico">Técnico</option>
              <option value="Facturación">Facturación</option>
              <option value="Cuenta">Cuenta</option>
              <option value="Funcionalidad">Funcionalidad</option>
              <option value="Bug">Reporte de Bug</option>
              <option value="Consulta General">Consulta General</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prioridad <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPriority('low')}
                className={`px-4 py-3 rounded-lg border-2 transition font-medium ${
                  priority === 'low'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-green-300'
                }`}
              >
                Baja
              </button>
              <button
                type="button"
                onClick={() => setPriority('medium')}
                className={`px-4 py-3 rounded-lg border-2 transition font-medium ${
                  priority === 'medium'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300'
                }`}
              >
                Media
              </button>
              <button
                type="button"
                onClick={() => setPriority('high')}
                className={`px-4 py-3 rounded-lg border-2 transition font-medium ${
                  priority === 'high'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-red-300'
                }`}
              >
                Alta
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción del Problema <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe detalladamente el problema que estás experimentando..."
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
              required
            />
            <p className="text-sm text-gray-500 mt-2">
              Incluye todos los detalles relevantes para ayudarnos a resolver tu problema más rápido
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archivos Adjuntos
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600"
            >
              <Paperclip className="w-5 h-5" />
              <span className="font-medium">Seleccionar archivos</span>
            </button>
            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(file.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="ml-3 p-1 text-gray-400 hover:text-red-600 transition"
                      disabled={uploading || loading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Puedes adjuntar imágenes, documentos PDF, Excel, Word y otros archivos
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Una vez enviado, nuestro equipo de soporte revisará tu ticket y te contactará.
              Los tickets son gestionados por el equipo de soporte y administradores.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Subiendo archivos...' : loading ? 'Creando...' : 'Crear Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
