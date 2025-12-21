import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Users, User, Paperclip, FileText, Image, File } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Task {
  id: string;
  title: string;
  description: string;
  client_name: string | null;
  due_date: string;
  priority: 'low' | 'medium' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  is_personal?: boolean;
  task_manager_id?: string | null;
  assigned_users?: Array<{ id: string; full_name: string; avatar_url?: string }>;
  assigned_departments?: Array<{ id: string; name: string }>;
}

interface EditTaskModalProps {
  task: Task;
  onClose: () => void;
  onSuccess: () => void;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
}

export function EditTaskModal({ task, onClose, onSuccess }: EditTaskModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form fields - inicializar con valores de la tarea
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [clientName, setClientName] = useState(task.client_name || '');
  const [clientNameInput, setClientNameInput] = useState(task.client_name || '');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  // Convertir fecha ISO a formato datetime-local
  const formatDateForInput = (isoDate: string): string => {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  const [dueDate, setDueDate] = useState(formatDateForInput(task.due_date));
  const [priority, setPriority] = useState<'low' | 'medium' | 'urgent'>(task.priority);
  const [isPersonal, setIsPersonal] = useState(task.is_personal || false);
  const [assignmentType, setAssignmentType] = useState<'user' | 'department'>('user');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(task.assigned_users?.map(u => u.id) || []);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(task.assigned_departments?.[0]?.id || '');
  const [taskManagerId, setTaskManagerId] = useState(task.task_manager_id || '');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Data
  const [users, setUsers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clients, setClients] = useState<{client_name: string}[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchClients();
    
    // Determinar el tipo de asignación basado en las asignaciones actuales
    if (task.assigned_departments && task.assigned_departments.length > 0) {
      setAssignmentType('department');
    } else if (task.assigned_users && task.assigned_users.length > 0) {
      setAssignmentType('user');
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('subforums')
        .select('client_name')
        .order('client_name');

      if (error) throw error;
      
      // Obtener valores únicos
      const uniqueClients = Array.from(
        new Set(data?.map(s => s.client_name).filter(Boolean) || [])
      ).map(name => ({ client_name: name }));

      setClients(uniqueClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const filteredClients = clients.filter(c => 
    c.client_name.toLowerCase().includes(clientNameInput.toLowerCase())
  );

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

  const uploadFiles = async (taskId: string) => {
    if (selectedFiles.length === 0 || !profile?.id) return;

    if (!profile?.tenant_id) {
      alert('No se pudo identificar la empresa');
      setUploading(false);
      return;
    }

    setUploading(true);
    try {
      const { data: messageData, error: messageError } = await supabase
        .from('task_messages')
        .insert([
          {
            task_id: taskId,
            user_id: profile.id,
            message: selectedFiles.length === 1 
              ? `📎 ${selectedFiles[0].name}` 
              : `📎 ${selectedFiles.length} archivos adjuntos`,
            tenant_id: profile.tenant_id // Agregar tenant_id para aislamiento multi-tenant
          }
        ])
        .select()
        .single();

      if (messageError) throw messageError;

      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${taskId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('task_attachments')
          .insert([
            {
              task_id: taskId,
              message_id: messageData.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type,
              uploaded_by: profile.id,
              tenant_id: profile.tenant_id // Agregar tenant_id para aislamiento multi-tenant
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

  const validateForm = (): string | null => {
    if (!title.trim()) return 'El título es requerido';
    if (!description.trim()) return 'La descripción es requerida';
    if (!dueDate) return 'La fecha límite es requerida';
    
    const selectedDate = new Date(dueDate);
    const now = new Date();
    if (selectedDate < now) {
      return 'La fecha límite debe ser futura';
    }

    if (!isPersonal) {
      if (assignmentType === 'user' && selectedUserIds.length === 0) {
        return 'Debes seleccionar al menos un usuario';
      }

      if (assignmentType === 'department' && !selectedDepartmentId) {
        return 'Debes seleccionar un área';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!profile) return;

    // Verificar permisos: solo admin, task_manager o creador pueden editar
    const canEdit = 
      profile.role === 'admin' || 
      task.task_manager_id === profile.id ||
      task.created_by === profile.id;

    if (!canEdit) {
      setError('No tienes permisos para editar esta tarea');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Convertir dueDate a ISO
      let dueDateISO = dueDate;
      if (dueDate) {
        const localDate = new Date(dueDate);
        dueDateISO = localDate.toISOString();
      }

      // Actualizar la tarea
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          description: description.trim(),
          client_name: clientName.trim() || null,
          due_date: dueDateISO,
          priority,
          task_manager_id: (!isPersonal && taskManagerId) ? taskManagerId : null,
          is_personal: isPersonal
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Actualizar asignaciones solo si NO es personal
      if (!isPersonal) {
        // Eliminar asignaciones existentes
        const { error: deleteError } = await supabase
          .from('task_assignments')
          .delete()
          .eq('task_id', task.id);

        if (deleteError) throw deleteError;

        // Crear nuevas asignaciones
        const assignments = [];

        if (assignmentType === 'user') {
          for (const userId of selectedUserIds) {
            assignments.push({
              task_id: task.id,
              assigned_to_user: userId,
              assigned_by: profile.id
            });
          }
        } else {
          assignments.push({
            task_id: task.id,
            assigned_to_department: selectedDepartmentId,
            assigned_by: profile.id
          });
        }

        if (assignments.length > 0) {
          const { error: assignmentError } = await supabase
            .from('task_assignments')
            .insert(assignments);

          if (assignmentError) throw assignmentError;
        }
      }

      // Subir archivos si hay alguno seleccionado
      if (selectedFiles.length > 0) {
        await uploadFiles(task.id);
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error updating task:', error);
      setError(error.message || 'Error al actualizar la tarea');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-none sm:rounded-lg shadow-xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto overflow-x-hidden task-modal-scroll">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Editar Tarea</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-x-hidden">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Título <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
              placeholder="Título de la tarea"
              required
              maxLength={200}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y whitespace-pre-wrap"
              style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
              placeholder="Descripción detallada de la tarea"
              required
            />
          </div>

          {/* Archivos Adjuntos (Opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Archivos Adjuntos <span className="text-gray-400 dark:text-gray-500 text-xs">(Opcional)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300"
            >
              <Paperclip className="w-5 h-5" />
              <span>Seleccionar archivos</span>
            </button>
            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600"
                  >
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cliente (Opcional) */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cliente <span className="text-gray-400 dark:text-gray-500 text-xs">(Opcional)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={clientNameInput}
                onChange={(e) => {
                  setClientNameInput(e.target.value);
                  setClientName(e.target.value);
                  setShowClientDropdown(e.target.value.length > 0 && filteredClients.length > 0);
                }}
                onFocus={() => {
                  if (filteredClients.length > 0) setShowClientDropdown(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowClientDropdown(false), 200);
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Escribe o selecciona un cliente"
              />
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto task-dropdown-scroll">
                  <button
                    type="button"
                    onClick={() => {
                      setClientName('');
                      setClientNameInput('');
                      setShowClientDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm text-gray-500 dark:text-gray-400"
                  >
                    Sin cliente
                  </button>
                  {filteredClients.map((client, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setClientName(client.client_name);
                        setClientNameInput(client.client_name);
                        setShowClientDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm text-gray-900 dark:text-white"
                    >
                      {client.client_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fecha y Hora de Finalización */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha y Hora Límite <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Prioridad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Prioridad <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPriority('low')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  priority === 'low'
                    ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <div className="text-center">
                  <div className="w-4 h-4 rounded-full bg-green-500 mx-auto mb-2"></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Baja</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPriority('medium')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  priority === 'medium'
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <div className="text-center">
                  <div className="w-4 h-4 rounded-full bg-blue-500 mx-auto mb-2"></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Media</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPriority('urgent')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  priority === 'urgent'
                    ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <div className="text-center">
                  <div className="w-4 h-4 rounded-full bg-red-500 mx-auto mb-2"></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Urgente</span>
                </div>
              </button>
            </div>
          </div>

          {/* Tarea Personal */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 rounded-lg p-4">
            <label className={`flex items-center gap-3 ${profile?.role === 'admin' ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
              <input
                type="checkbox"
                checked={isPersonal}
                onChange={(e) => {
                  setIsPersonal(e.target.checked);
                  if (e.target.checked) {
                    setSelectedUserIds([]);
                    setSelectedDepartmentId('');
                    setTaskManagerId('');
                  }
                }}
                disabled={profile?.role !== 'admin'}
                className="w-5 h-5 text-purple-600 dark:text-purple-400 border-gray-300 dark:border-slate-600 rounded focus:ring-purple-500 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Tarea Personal</span>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {profile?.role === 'admin' 
                    ? 'Esta tarea será solo para ti. No se asignará a otros usuarios ni departamentos.' 
                    : 'Como usuario regular, solo puedes crear tareas personales.'}
                </p>
              </div>
            </label>
          </div>

          {/* Tipo de Asignación (solo si NO es personal) */}
          {!isPersonal && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Asignar a <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setAssignmentType('user')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  assignmentType === 'user'
                    ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <User className="w-5 h-5" />
                <span className="font-medium text-gray-900 dark:text-white">Usuario Individual</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('department')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  assignmentType === 'department'
                    ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="font-medium text-gray-900 dark:text-white">Área</span>
              </button>
            </div>

            {/* Selector de Usuarios Múltiples */}
            {assignmentType === 'user' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">Selecciona uno o más usuarios:</p>
                <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700 task-dropdown-scroll">
                  {users.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No hay usuarios disponibles</p>
                  ) : (
                    users.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds([...selectedUserIds, user.id]);
                            } else {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {selectedUserIds.length > 0 && (
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    {selectedUserIds.length} usuario(s) seleccionado(s)
                  </p>
                )}
              </div>
            )}

            {/* Selector de Departamento */}
            {assignmentType === 'department' && (
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">Selecciona un área</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          )}

          {/* Administrador de Tarea (Opcional) - Solo para tareas de equipo */}
          {!isPersonal && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Administrador de Tarea <span className="text-gray-400 dark:text-gray-500 text-xs">(Opcional)</span>
            </label>
            <select
              value={taskManagerId}
              onChange={(e) => setTaskManagerId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Sin administrador</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} {user.role === 'admin' ? '(Admin)' : user.role === 'support' ? '(Soporte)' : '(Usuario)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              El administrador puede cambiar el estado de la tarea. Puede ser cualquier usuario.
            </p>
          </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="px-6 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {(loading || uploading) && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {loading ? 'Guardando...' : uploading ? 'Subiendo archivos...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

