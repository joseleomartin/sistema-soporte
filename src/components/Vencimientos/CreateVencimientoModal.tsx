import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, File, FileText, Image, Upload, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

interface CreateVencimientoModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialClientName?: string;
  initialClientCuit?: string;
  initialVencimientoTipo?: string;
  initialPeriodo?: string;
  initialFechaVencimiento?: string;
  initialFechaVencimientoOriginal?: string;
  initialTitle?: string;
  initialDescription?: string;
}

export function CreateVencimientoModal({
  onClose,
  onSuccess,
  initialClientName,
  initialClientCuit,
  initialVencimientoTipo,
  initialPeriodo,
  initialFechaVencimiento,
  initialFechaVencimientoOriginal,
  initialTitle,
  initialDescription
}: CreateVencimientoModalProps) {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState(initialTitle || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [clientName, setClientName] = useState(initialClientName || '');
  const [clientCuit, setClientCuit] = useState(initialClientCuit || '');
  const [vencimientoTipo, setVencimientoTipo] = useState(initialVencimientoTipo || 'IVA');
  const [periodo, setPeriodo] = useState(initialPeriodo || '');
  const [fechaVencimiento, setFechaVencimiento] = useState(initialFechaVencimiento || '');
  const [fechaVencimientoOriginal, setFechaVencimientoOriginal] = useState(initialFechaVencimientoOriginal || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'urgent'>('medium');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialClientName) setClientName(initialClientName);
    if (initialClientCuit) setClientCuit(initialClientCuit);
    if (initialVencimientoTipo) setVencimientoTipo(initialVencimientoTipo);
    if (initialPeriodo) setPeriodo(initialPeriodo);
    if (initialFechaVencimiento) setFechaVencimiento(initialFechaVencimiento);
    if (initialFechaVencimientoOriginal) setFechaVencimientoOriginal(initialFechaVencimientoOriginal);
    if (initialTitle) setTitle(initialTitle);
    if (initialDescription) setDescription(initialDescription);
  }, [initialClientName, initialClientCuit, initialVencimientoTipo, initialPeriodo, initialFechaVencimiento, initialFechaVencimientoOriginal, initialTitle, initialDescription]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-5 h-5 text-blue-600" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-600" />;
    } else {
      return <File className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const uploadFiles = async (vencimientoId: string) => {
    if (selectedFiles.length === 0 || !profile?.id || !tenantId) return;

    setUploading(true);
    try {
      // Crear un mensaje automático para los archivos iniciales
      const { data: messageData, error: messageError } = await supabase
        .from('vencimientos_gestion_messages')
        .insert([
          {
            vencimiento_id: vencimientoId,
            user_id: profile.id,
            message: selectedFiles.length === 1 
              ? `📎 ${selectedFiles[0].name}` 
              : `📎 ${selectedFiles.length} archivos adjuntos`,
            tenant_id: tenantId
          }
        ])
        .select()
        .single();

      if (messageError) throw messageError;

      // Subir archivos y asociarlos al mensaje
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${vencimientoId}/${fileName}`;

        // Subir archivo a Storage
        const { error: uploadError } = await supabase.storage
          .from('vencimientos-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Guardar metadata en la base de datos
        const { error: dbError } = await supabase
          .from('vencimientos_gestion_attachments')
          .insert([
            {
              vencimiento_id: vencimientoId,
              message_id: messageData.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
              uploaded_by: profile.id,
              tenant_id: tenantId
            }
          ]);

        if (dbError) throw dbError;
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    if (!clientName.trim()) {
      setError('El nombre del cliente es requerido');
      return;
    }

    if (!fechaVencimiento) {
      setError('La fecha de vencimiento es requerida');
      return;
    }

    if (!profile || !tenantId) {
      setError('No se pudo identificar el usuario o la empresa');
      return;
    }

    try {
      setLoading(true);

      // Convertir fecha a formato DATE
      const fechaVencimientoDate = new Date(fechaVencimiento).toISOString().split('T')[0];

      // Buscar el cliente para obtener el usuario responsable de vencimientos
      let responsableId: string | null = null;
      if (clientName.trim() || clientCuit.trim()) {
        let query = supabase
          .from('subforums')
          .select('vencimientos_responsable_id')
          .eq('tenant_id', tenantId);
        
        if (clientName.trim()) {
          query = query.eq('client_name', clientName.trim());
        } else if (clientCuit.trim()) {
          query = query.eq('cuit', clientCuit.trim());
        }
        
        const { data: clienteData } = await query.limit(1).maybeSingle();
        if (clienteData?.vencimientos_responsable_id) {
          responsableId = clienteData.vencimientos_responsable_id;
        }
      }

      const { data: vencimientoData, error: vencimientoError } = await supabase
        .from('vencimientos_gestion')
        .insert([
          {
            title: title.trim(),
            description: description.trim() || null,
            client_name: clientName.trim(),
            client_cuit: clientCuit.trim() || null,
            vencimiento_tipo: vencimientoTipo,
            periodo: periodo.trim(),
            fecha_vencimiento: fechaVencimientoDate,
            fecha_vencimiento_original: fechaVencimientoOriginal || null,
            priority,
            status: 'pending',
            created_by: profile.id,
            tenant_id: tenantId
          }
        ])
        .select()
        .single();

      if (vencimientoError) throw vencimientoError;

      // Si hay un usuario responsable, asignarlo automáticamente
      if (responsableId && vencimientoData) {
        const { error: assignmentError } = await supabase
          .from('vencimientos_gestion_assignments')
          .insert([
            {
              vencimiento_id: vencimientoData.id,
              assigned_to_user: responsableId,
              assigned_by: profile.id,
              tenant_id: tenantId
            }
          ]);

        if (assignmentError) {
          console.warn('No se pudo asignar automáticamente al usuario responsable:', assignmentError);
        }
      }

      // Subir archivos si hay alguno seleccionado
      if (selectedFiles.length > 0 && vencimientoData) {
        try {
          await uploadFiles(vencimientoData.id);
        } catch (fileError) {
          console.error('Error subiendo archivos:', fileError);
          // No bloqueamos la creación del vencimiento si falla la subida de archivos
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error creating vencimiento:', error);
      setError(error.message || 'Error al crear el vencimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nuevo Vencimiento</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cliente *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CUIT
              </label>
              <input
                type="text"
                value={clientCuit}
                onChange={(e) => setClientCuit(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Vencimiento *
              </label>
              <select
                value={vencimientoTipo}
                onChange={(e) => setVencimientoTipo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              >
                <option value="IVA">IVA</option>
                <option value="Monotributo">Monotributo</option>
                <option value="Autónomos">Autónomos</option>
                <option value="Ingresos Brutos">Ingresos Brutos</option>
                <option value="Relación de Dependencia">Relación de Dependencia</option>
                <option value="Servicio Doméstico">Servicio Doméstico</option>
                <option value="Personas Humanas">Personas Humanas</option>
                <option value="Personas Jurídicas">Personas Jurídicas</option>
                <option value="Retenciones">Retenciones</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Período *
              </label>
              <input
                type="text"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                placeholder="Ej: Enero 2026"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha de Vencimiento *
              </label>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Original (del Excel)
              </label>
              <input
                type="text"
                value={fechaVencimientoOriginal}
                onChange={(e) => setFechaVencimientoOriginal(e.target.value)}
                placeholder="Ej: 20-feb"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prioridad
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'urgent')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          {/* Sección de archivos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Archivos Adjuntos (opcional)
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg p-4 transition"
              >
                <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Haz clic para seleccionar archivos o arrastra aquí
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Máximo 50MB por archivo
                </span>
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded-lg"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getFileIcon(file.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-slate-700 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Subiendo archivos...' : loading ? 'Creando...' : 'Crear Vencimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
