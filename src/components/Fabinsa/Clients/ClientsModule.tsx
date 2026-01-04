/**
 * Módulo de Clientes (para Empresas de Producción)
 * Gestión de clientes con documentos
 * Similar al módulo de Proveedores
 */

import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Save, X, FileText, Upload, Download, Folder, ExternalLink } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Database } from '../../../lib/database.types';
import { GoogleDriveFolderSelector } from '../../Forums/GoogleDriveFolderSelector';
import { GoogleDriveViewer } from '../../Forums/GoogleDriveViewer';
import { DriveFolder } from '../../../lib/googleDriveAPI';
import { useDepartmentPermissions } from '../../../hooks/useDepartmentPermissions';
import { BulkImportClientsModal } from './BulkImportClientsModal';

type Client = Database['public']['Tables']['clients']['Row'];
type ClientInsert = Database['public']['Tables']['clients']['Insert'];
type ClientDocument = Database['public']['Tables']['client_documents']['Row'];

interface FileAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  uploader_name: string;
  file_path?: string;
}

export function ClientsModule() {
  const { tenantId } = useTenant();
  const { profile } = useAuth();
  const { canCreate, canEdit, canDelete } = useDepartmentPermissions();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [documents, setDocuments] = useState<FileAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Google Drive states
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [driveFolderName, setDriveFolderName] = useState<string | null>(null);
  const [driveFolderLink, setDriveFolderLink] = useState<string | null>(null);
  const [loadingDriveMapping, setLoadingDriveMapping] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'drive'>('files');
  const [showImportModal, setShowImportModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    razon_social: '',
    cuit: '',
    telefono: '',
    email: '',
    provincia: '',
    direccion: '',
    observaciones: '',
  });

  useEffect(() => {
    if (tenantId) {
      loadClients();
    }
  }, [tenantId]);

  const loadClients = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const clientData: ClientInsert = {
        tenant_id: tenantId,
        nombre: formData.nombre.trim(),
        razon_social: formData.razon_social.trim() || null,
        cuit: formData.cuit.trim() || null,
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null,
        provincia: formData.provincia.trim() || null,
        direccion: formData.direccion.trim() || null,
        observaciones: formData.observaciones.trim() || null,
      };

      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', editingClient.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clients')
          .insert(clientData);

        if (error) throw error;
      }

      resetForm();
      loadClients();
    } catch (error: any) {
      console.error('Error saving client:', error);
      alert(`Error al guardar el cliente: ${error?.message || 'Error desconocido'}`);
    }
  };

  const handleEdit = (client: Client) => {
    setFormData({
      nombre: client.nombre,
      razon_social: client.razon_social || '',
      cuit: client.cuit || '',
      telefono: client.telefono || '',
      email: client.email || '',
      provincia: client.provincia || '',
      direccion: client.direccion || '',
      observaciones: client.observaciones || '',
    });
    setEditingClient(client);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este cliente?')) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Error al eliminar el cliente');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      razon_social: '',
      cuit: '',
      telefono: '',
      email: '',
      provincia: '',
      direccion: '',
      observaciones: '',
    });
    setEditingClient(null);
    setShowForm(false);
  };

  const openDocumentsModal = async (client: Client) => {
    setSelectedClient(client);
    setShowDocumentsModal(true);
    await loadDocuments(client.id);
    await loadDriveMapping(client.id);
  };

  const loadDocuments = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_documents')
        .select(`
          *,
          profiles:uploaded_by(full_name)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const files: FileAttachment[] = (data || []).map((doc: any) => {
        const { data: urlData } = supabase.storage
          .from('client-documents')
          .getPublicUrl(doc.file_path);

        return {
          id: doc.id,
          file_name: doc.file_name,
          file_url: urlData.publicUrl,
          file_type: doc.file_type,
          file_size: doc.file_size,
          uploaded_at: doc.created_at,
          uploader_name: doc.profiles?.full_name || 'Usuario desconocido',
          file_path: doc.file_path, // Guardar el path para eliminación
        };
      });

      setDocuments(files);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const loadDriveMapping = async (clientId: string) => {
    try {
      setLoadingDriveMapping(true);
      const { data, error } = await supabase
        .from('client_drive_mapping')
        .select('google_drive_folder_id, folder_name, folder_link')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading drive mapping:', error);
      } else if (data) {
        setDriveFolderId(data.google_drive_folder_id);
        setDriveFolderName(data.folder_name);
        setDriveFolderLink(data.folder_link || `https://drive.google.com/drive/folders/${data.google_drive_folder_id}`);
      }
    } catch (error) {
      console.error('Error loading drive mapping:', error);
    } finally {
      setLoadingDriveMapping(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadFiles = async () => {
    if (!selectedClient || !profile || selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Subir archivo a storage
        const { error: uploadError } = await supabase.storage
          .from('client-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Registrar en base de datos
        const { error: dbError } = await supabase
          .from('client_documents')
          .insert({
            client_id: selectedClient.id,
            tenant_id: tenantId!,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: profile.id,
          });

        if (dbError) throw dbError;
      }

      setSelectedFiles([]);
      await loadDocuments(selectedClient.id);
    } catch (error: any) {
      console.error('Error uploading files:', error);
      alert(`Error al subir archivos: ${error?.message || 'Error desconocido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string, filePath: string) => {
    if (!confirm('¿Eliminar este documento?')) return;

    try {
      // Eliminar de storage
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([filePath]);

      if (storageError) console.error('Error deleting from storage:', storageError);

      // Eliminar de base de datos
      const { error: dbError } = await supabase
        .from('client_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      if (selectedClient) {
        await loadDocuments(selectedClient.id);
      }
    } catch (error: any) {
      console.error('Error deleting document:', error);
      alert(`Error al eliminar documento: ${error?.message || 'Error desconocido'}`);
    }
  };

  const handleSelectDriveFolder = async (folder: DriveFolder) => {
    if (!selectedClient || !tenantId) return;

    try {
      const { error } = await supabase.rpc('save_client_drive_mapping', {
        p_client_id: selectedClient.id,
        p_google_drive_folder_id: folder.id,
        p_folder_name: folder.name,
        p_folder_link: folder.webViewLink || null,
      });

      if (error) {
        if (error.code === '42883') {
          throw new Error('La función save_client_drive_mapping no existe. Ejecuta la migración SQL.');
        }
        throw error;
      }

      setDriveFolderId(folder.id);
      setDriveFolderName(folder.name);
      setDriveFolderLink(folder.webViewLink);
    } catch (error: any) {
      console.error('Error saving drive mapping:', error);
      alert(`Error al guardar carpeta: ${error?.message || 'Error desconocido'}`);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileText className="w-5 h-5 text-green-600" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600" />;
    } else {
      return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 -mx-6 -mt-6 mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Users className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">Gestión de clientes y documentos</p>
      </div>

      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Lista de Clientes</h2>
        {canCreate('forums') && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Upload className="w-4 h-4" />
              <span>Importar</span>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Cliente</span>
            </button>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button onClick={resetForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    value={formData.razon_social}
                    onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CUIT
                  </label>
                  <input
                    type="text"
                    value={formData.cuit}
                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Provincia
                  </label>
                  <input
                    type="text"
                    value={formData.provincia}
                    onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocumentsModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Documentos de {selectedClient.nombre}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Gestión de archivos y documentos</p>
              </div>
              <button
                onClick={() => {
                  setShowDocumentsModal(false);
                  setSelectedClient(null);
                  setDocuments([]);
                  setDriveFolderId(null);
                  setDriveFolderName(null);
                  setDriveFolderLink(null);
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-6">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('files')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'files'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Archivos
                </button>
                <button
                  onClick={() => setActiveTab('drive')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'drive'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Google Drive
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'files' && (
                <div className="space-y-4">
                  {/* Upload Section */}
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
                    <div className="text-center">
                      <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                      <input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Seleccionar Archivos</span>
                      </label>
                      {selectedFiles.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Archivos seleccionados:</p>
                          <div className="space-y-2">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                <span className="text-sm text-gray-900 dark:text-white">{file.name}</span>
                                <button
                                  onClick={() => removeFile(index)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={handleUploadFiles}
                            disabled={uploading}
                            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                          >
                            {uploading ? 'Subiendo...' : 'Subir Archivos'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Files List */}
                  <div className="space-y-2">
                    {documents.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay documentos</p>
                    ) : (
                      documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center space-x-3">
                            {getFileIcon(doc.file_type)}
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{doc.file_name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {formatFileSize(doc.file_size)} • {new Date(doc.uploaded_at).toLocaleDateString()} • {doc.uploader_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => {
                                if (doc.file_path) {
                                  handleDeleteDocument(doc.id, doc.file_path);
                                } else {
                                  alert('Error: No se pudo obtener la ruta del archivo');
                                }
                              }}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'drive' && (
                <div className="space-y-4">
                  {loadingDriveMapping ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">Cargando...</div>
                    </div>
                  ) : driveFolderId ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Folder className="w-6 h-6 text-blue-600" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{driveFolderName}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-300">Carpeta de Google Drive vinculada</p>
                            </div>
                          </div>
                          {driveFolderLink && (
                            <a
                              href={driveFolderLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span>Abrir en Drive</span>
                            </a>
                          )}
                        </div>
                      </div>
                      <GoogleDriveViewer folderId={driveFolderId} />
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Folder className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300 mb-4">No hay carpeta de Google Drive vinculada</p>
                      {profile && (profile.role === 'admin' || profile.role === 'support') && (
                        <GoogleDriveFolderSelector
                          onSelectFolder={handleSelectDriveFolder}
                          currentFolderId={null}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clients Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 table-auto">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-2 sm:px-3 md:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[20%]">
                  Nombre
                </th>
                <th className="px-2 sm:px-3 md:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell w-[18%]">
                  Razón Social
                </th>
                <th className="px-2 sm:px-3 md:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell w-[12%]">
                  CUIT
                </th>
                <th className="px-2 sm:px-3 md:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell w-[12%]">
                  Teléfono
                </th>
                <th className="px-2 sm:px-3 md:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell w-[18%]">
                  Email
                </th>
                <th className="px-2 sm:px-3 md:px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden xl:table-cell w-[10%]">
                  Provincia
                </th>
                <th className="px-2 sm:px-3 md:px-4 lg:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[10%]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No hay clientes registrados
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={client.nombre}>
                        {client.nombre}
                      </div>
                      {/* Información adicional en móviles */}
                      <div className="md:hidden mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                        {client.telefono && <div className="truncate">📞 {client.telefono}</div>}
                        {client.email && <div className="truncate">✉️ {client.email}</div>}
                        {client.razon_social && <div className="truncate">🏢 {client.razon_social}</div>}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      <div className="truncate" title={client.razon_social || ''}>
                        {client.razon_social || '-'}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      <div className="truncate" title={client.cuit || ''}>
                        {client.cuit || '-'}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      <div className="truncate" title={client.telefono || ''}>
                        {client.telefono || '-'}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      <div className="truncate" title={client.email || ''}>
                        {client.email || '-'}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 text-sm text-gray-500 dark:text-gray-400 hidden xl:table-cell">
                      <div className="truncate" title={client.provincia || ''}>
                        {client.provincia || '-'}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 text-right text-sm font-medium">
                      <div className="flex justify-end space-x-1 sm:space-x-2 flex-shrink-0">
                        <button
                          onClick={() => openDocumentsModal(client)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 flex-shrink-0"
                          title="Ver documentos"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {canEdit('forums') && (
                          <button
                            onClick={() => handleEdit(client)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 flex-shrink-0"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete('forums') && (
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 flex-shrink-0"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Importación */}
      {showImportModal && (
        <BulkImportClientsModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            loadClients();
            setShowImportModal(false);
          }}
        />
      )}
    </div>
  );
}

