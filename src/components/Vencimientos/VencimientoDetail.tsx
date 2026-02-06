import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Calendar, Users, AlertCircle, File, FileText, Image, Upload, Trash2, Download, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import type { Vencimiento } from './VencimientosList';

interface VencimientoDetailProps {
  vencimiento: Vencimiento;
  onBack: () => void;
  onUpdate?: (updatedVencimiento: Vencimiento) => void;
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export function VencimientoDetail({ vencimiento: initialVencimiento, onBack, onUpdate }: VencimientoDetailProps) {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const [vencimiento, setVencimiento] = useState<Vencimiento>(initialVencimiento);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVencimiento(initialVencimiento);
  }, [initialVencimiento]);

  useEffect(() => {
    loadAttachments();
  }, [vencimiento.id]);

  const loadAttachments = async () => {
    try {
      setLoadingAttachments(true);
      const { data, error } = await supabase
        .from('vencimientos_gestion_attachments')
        .select('*')
        .eq('vencimiento_id', vencimiento.id)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error loading attachments:', error);
    } finally {
      setLoadingAttachments(false);
    }
  };

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

  const uploadFiles = async () => {
    if (selectedFiles.length === 0 || !profile?.id || !tenantId) return;

    setUploading(true);
    try {
      // Crear un mensaje automático para los archivos
      const { data: messageData, error: messageError } = await supabase
        .from('vencimientos_gestion_messages')
        .insert([
          {
            vencimiento_id: vencimiento.id,
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

      // Subir archivos
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${vencimiento.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('vencimientos-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('vencimientos_gestion_attachments')
          .insert([
            {
              vencimiento_id: vencimiento.id,
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

      setSelectedFiles([]);
      await loadAttachments();
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error al subir archivos');
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('vencimientos-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error al descargar el archivo');
    }
  };

  const deleteFile = async (attachment: Attachment) => {
    if (!confirm(`¿Estás seguro de eliminar ${attachment.file_name}?`)) return;

    try {
      // Eliminar de storage
      const { error: storageError } = await supabase.storage
        .from('vencimientos-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Eliminar de base de datos
      const { error: dbError } = await supabase
        .from('vencimientos_gestion_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      await loadAttachments();
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error al eliminar el archivo');
    }
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

  const handleStatusChange = async (newStatus: string) => {
    if (!profile || !tenantId) {
      alert('No se pudo identificar el usuario o la empresa');
      return;
    }

    try {
      setUpdatingStatus(true);

      const { data, error } = await supabase
        .from('vencimientos_gestion')
        .update({ 
          status: newStatus,
          tenant_id: tenantId
        })
        .eq('id', vencimiento.id)
        .select()
        .single();

      if (error) throw error;

      setVencimiento(data);
      // Notificar al componente padre sobre la actualización
      if (onUpdate) {
        onUpdate(data);
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert(`Error al actualizar el estado: ${error.message || 'Error desconocido'}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!profile || !tenantId) {
      alert('No se pudo identificar el usuario o la empresa');
      return;
    }

    try {
      setUpdatingStatus(true);

      const { data, error } = await supabase
        .from('vencimientos_gestion')
        .update({ 
          priority: newPriority,
          tenant_id: tenantId
        })
        .eq('id', vencimiento.id)
        .select()
        .single();

      if (error) throw error;

      setVencimiento(data);
      // Notificar al componente padre sobre la actualización
      if (onUpdate) {
        onUpdate(data);
      }
    } catch (error: any) {
      console.error('Error updating priority:', error);
      alert(`Error al actualizar la prioridad: ${error.message || 'Error desconocido'}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
      case 'urgent':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'in_progress':
        return 'En Progreso';
      case 'completed':
        return 'Completado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'Baja';
      case 'medium':
        return 'Media';
      case 'urgent':
        return 'Urgente';
      default:
        return priority;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="p-4 sm:p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Volver a Vencimientos</span>
      </button>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {vencimiento.title}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Cliente</label>
            <p className="text-gray-900 dark:text-white">{vencimiento.client_name}</p>
          </div>

          {vencimiento.client_cuit && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">CUIT</label>
              <p className="text-gray-900 dark:text-white">{vencimiento.client_cuit}</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipo de Vencimiento</label>
            <p className="text-gray-900 dark:text-white">{vencimiento.vencimiento_tipo}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Período</label>
            <p className="text-gray-900 dark:text-white">{vencimiento.periodo}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Fecha de Vencimiento</label>
            <p className="text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {formatDate(vencimiento.fecha_vencimiento)}
            </p>
          </div>

          {vencimiento.description && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Descripción</label>
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{vencimiento.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Estado
              </label>
              <select
                value={vencimiento.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition ${
                  getStatusColor(vencimiento.status)
                } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <option value="pending">Pendiente</option>
                <option value="in_progress">En Progreso</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
              {updatingStatus && (
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Actualizando...</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Prioridad
              </label>
              <select
                value={vencimiento.priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                disabled={updatingStatus}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition ${
                  getPriorityColor(vencimiento.priority)
                } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Archivos Adjuntos */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Archivos Adjuntos</h3>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload-detail"
          />
          <label
            htmlFor="file-upload-detail"
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Subir Archivos
          </label>
        </div>

        {/* Archivos seleccionados para subir */}
        {selectedFiles.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                {selectedFiles.length} archivo(s) listo(s) para subir
              </span>
              <div className="flex gap-2">
                <button
                  onClick={uploadFiles}
                  disabled={uploading}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? 'Subiendo...' : 'Subir'}
                </button>
                <button
                  onClick={() => setSelectedFiles([])}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de archivos adjuntos */}
        {loadingAttachments ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando archivos...</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No hay archivos adjuntos</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getFileIcon(attachment.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {attachment.file_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(attachment.file_size)} • {new Date(attachment.uploaded_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadFile(attachment)}
                    className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {(profile?.id === attachment.uploaded_by || profile?.role === 'admin') && (
                    <button
                      onClick={() => deleteFile(attachment)}
                      className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
