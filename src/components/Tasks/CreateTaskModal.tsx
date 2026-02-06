import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Users, User, Paperclip, FileText, Image, File } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CreateTaskModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialClientName?: string;
  initialDueDate?: string;
  initialTitle?: string;
  initialDescription?: string;
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

export function CreateTaskModal({ onClose, onSuccess, initialClientName, initialDueDate, initialTitle, initialDescription }: CreateTaskModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form fields
  const [title, setTitle] = useState(initialTitle || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [clientName, setClientName] = useState(initialClientName || '');
  const [clientNameInput, setClientNameInput] = useState(initialClientName || '');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [dueDate, setDueDate] = useState(initialDueDate || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'urgent'>('medium');
  // Usuarios no-admin solo pueden crear tareas personales
  const [isPersonal, setIsPersonal] = useState(profile?.role !== 'admin');
  const [assignmentType, setAssignmentType] = useState<'user' | 'department'>('user');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [taskManagerId, setTaskManagerId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceMode, setRecurrenceMode] = useState<'day_of_month' | 'weekday'>('day_of_month');
  const [recurrenceWeekday, setRecurrenceWeekday] = useState<number | null>(null);
  const [recurrenceWeekPosition, setRecurrenceWeekPosition] = useState<number | null>(null);
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
  }, []);

  // Actualizar campos cuando cambien las props iniciales
  useEffect(() => {
    if (initialClientName) {
      setClientName(initialClientName);
      setClientNameInput(initialClientName);
    }
    if (initialDueDate) {
      setDueDate(initialDueDate);
    }
    if (initialTitle) {
      setTitle(initialTitle);
    }
    if (initialDescription) {
      setDescription(initialDescription);
    }
  }, [initialClientName, initialDueDate, initialTitle, initialDescription]);

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
    // Reset input para permitir seleccionar el mismo archivo nuevamente
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

    setUploading(true);
    try {
      // Verificar que tenemos tenant_id
      if (!profile?.tenant_id) {
        throw new Error('No se pudo identificar la empresa');
      }

      // Crear un mensaje automático para los archivos iniciales
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

      // Subir archivos y asociarlos al mensaje
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${taskId}/${fileName}`;

        // Subir archivo a Storage
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Guardar metadata en la base de datos asociada al mensaje
        const { error: dbError } = await supabase
          .from('task_attachments')
          .insert([
            {
              task_id: taskId,
              message_id: messageData.id, // Asociar al mensaje automático
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
    // clientName ahora es opcional
    if (!dueDate) return 'La fecha límite es requerida';
    
    const selectedDate = new Date(dueDate);
    const now = new Date();
    if (selectedDate < now) {
      return 'La fecha límite debe ser futura';
    }

    // Solo validar asignaciones si NO es una tarea personal
    if (!isPersonal) {
      if (assignmentType === 'user' && selectedUserIds.length === 0) {
        return 'Debes seleccionar al menos un usuario';
      }

      if (assignmentType === 'department' && selectedDepartmentIds.length === 0) {
        return 'Debes seleccionar al menos un área';
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

    try {
      setLoading(true);
      setError('');

      // Preparar patrón de recurrencia si es necesario
      const recurrencePattern = isRecurring ? {
        type: recurrenceType,
        interval: recurrenceInterval,
        end_date: recurrenceEndDate || null
      } : null;

      // Preparar campos de recurrencia por día de semana (solo para monthly)
      const recurrenceWeekdayValue = (isRecurring && recurrenceType === 'monthly' && recurrenceMode === 'weekday' && recurrenceWeekday !== null) 
        ? recurrenceWeekday 
        : null;
      const recurrenceWeekPositionValue = (isRecurring && recurrenceType === 'monthly' && recurrenceMode === 'weekday' && recurrenceWeekPosition !== null) 
        ? recurrenceWeekPosition 
        : null;

      // Convertir dueDate de datetime-local a ISO string con zona horaria
      // datetime-local devuelve "YYYY-MM-DDTHH:mm" sin zona horaria
      // Necesitamos crear un Date en la zona horaria local y convertirlo a ISO
      let dueDateISO = dueDate;
      if (dueDate) {
        // Crear un objeto Date a partir del valor datetime-local (se interpreta como hora local)
        const localDate = new Date(dueDate);
        // Convertir a ISO string (esto incluirá la zona horaria correcta)
        dueDateISO = localDate.toISOString();
      }

      // Verificar que tenemos tenant_id
      if (!profile?.tenant_id) {
        throw new Error('No se pudo identificar la empresa');
      }

      // Crear la tarea
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert([
          {
            title: title.trim(),
            description: description.trim(),
            client_name: clientName.trim() || null, // Permitir null
            due_date: dueDateISO,
            priority,
            status: 'pending',
            created_by: profile.id,
            tenant_id: profile.tenant_id, // Agregar tenant_id para aislamiento multi-tenant
            task_manager_id: (!isPersonal && taskManagerId) ? taskManagerId : null,
            is_recurring: isRecurring,
            recurrence_pattern: recurrencePattern,
            recurrence_weekday: recurrenceWeekdayValue,
            recurrence_week_position: recurrenceWeekPositionValue,
            is_personal: isPersonal // Nuevo campo
          }
        ])
        .select()
        .single();

      if (taskError) throw taskError;

      // Crear las asignaciones solo si NO es una tarea personal
      // (las tareas personales se auto-asignan automáticamente con el trigger)
      if (!isPersonal) {
        const assignments = [];

        if (assignmentType === 'user') {
          // Crear una asignación por cada usuario seleccionado
          for (const userId of selectedUserIds) {
            assignments.push({
              task_id: taskData.id,
              assigned_to_user: userId,
              assigned_by: profile.id,
              tenant_id: profile.tenant_id // Agregar tenant_id para aislamiento multi-tenant
            });
          }
        } else {
          // Crear una asignación por cada departamento seleccionado
          for (const departmentId of selectedDepartmentIds) {
            assignments.push({
              task_id: taskData.id,
              assigned_to_department: departmentId,
              assigned_by: profile.id,
              tenant_id: profile.tenant_id // Agregar tenant_id para aislamiento multi-tenant
            });
          }
        }

        const { error: assignmentError } = await supabase
          .from('task_assignments')
          .insert(assignments);

        if (assignmentError) throw assignmentError;
      }

      // Subir archivos si hay alguno seleccionado
      if (selectedFiles.length > 0) {
        await uploadFiles(taskData.id);
      }

      // Limpiar formulario
      setSelectedFiles([]);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating task:', error);
      setError(error.message || 'Error al crear la tarea');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-none sm:rounded-lg shadow-xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto task-modal-scroll">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Nueva Tarea</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
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
              placeholder="Título de la tarea"
              required
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
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
                  // Delay para permitir click en el dropdown
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
                  // Limpiar selecciones de asignación cuando se marca como personal
                  if (e.target.checked) {
                    setSelectedUserIds([]);
                    setSelectedDepartmentId('');
                    setTaskManagerId('');
                  }
                }}
                disabled={profile?.role !== 'admin'} // Solo admins pueden deseleccionar
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

            {/* Selector de Departamentos Múltiples */}
            {assignmentType === 'department' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">Selecciona una o más áreas:</p>
                <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700 task-dropdown-scroll">
                  {departments.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No hay áreas disponibles</p>
                  ) : (
                    departments.map((dept) => (
                      <label
                        key={dept.id}
                        className="flex items-center gap-3 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDepartmentIds.includes(dept.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDepartmentIds([...selectedDepartmentIds, dept.id]);
                            } else {
                              setSelectedDepartmentIds(selectedDepartmentIds.filter(id => id !== dept.id));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{dept.name}</p>
                          {dept.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{dept.description}</p>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {selectedDepartmentIds.length > 0 && (
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    {selectedDepartmentIds.length} área(s) seleccionada(s)
                  </p>
                )}
              </div>
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

          {/* Tarea Recurrente */}
          <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-gray-50 dark:bg-slate-700">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tarea recurrente</span>
            </label>
            {isRecurring && (
              <div className="mt-4 space-y-4 pl-7">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de recurrencia
                  </label>
                  <select
                    value={recurrenceType}
                    onChange={(e) => {
                      setRecurrenceType(e.target.value as 'daily' | 'weekly' | 'monthly');
                      // Resetear modo de recurrencia cuando cambia el tipo
                      if (e.target.value !== 'monthly') {
                        setRecurrenceMode('day_of_month');
                        setRecurrenceWeekday(null);
                        setRecurrenceWeekPosition(null);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="daily">Diaria</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
                {recurrenceType === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo de recurrencia mensual
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="recurrenceDayOfMonth"
                          name="recurrenceMode"
                          checked={recurrenceMode === 'day_of_month'}
                          onChange={() => {
                            setRecurrenceMode('day_of_month');
                            setRecurrenceWeekday(null);
                            setRecurrenceWeekPosition(null);
                          }}
                          className="w-4 h-4 text-indigo-600 dark:text-indigo-400 border-gray-300 dark:border-slate-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="recurrenceDayOfMonth" className="text-sm text-gray-700 dark:text-gray-300">
                          Mismo día del mes (ej: día 15 de cada mes)
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="recurrenceWeekday"
                          name="recurrenceMode"
                          checked={recurrenceMode === 'weekday'}
                          onChange={() => {
                            setRecurrenceMode('weekday');
                            // Establecer valores por defecto si no están configurados
                            if (recurrenceWeekday === null && dueDate) {
                              const date = new Date(dueDate);
                              const dayOfWeek = date.getDay(); // 0 = domingo, 1 = lunes, etc.
                              setRecurrenceWeekday(dayOfWeek);
                              // Calcular la posición en el mes
                              const dayOfMonth = date.getDate();
                              const weekPosition = Math.ceil(dayOfMonth / 7);
                              setRecurrenceWeekPosition(Math.min(weekPosition, 4));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 dark:text-indigo-400 border-gray-300 dark:border-slate-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="recurrenceWeekday" className="text-sm text-gray-700 dark:text-gray-300">
                          Día de la semana específico (ej: primer jueves de cada mes)
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {recurrenceType === 'monthly' && recurrenceMode === 'weekday' && (
                  <div className="space-y-3 bg-white dark:bg-slate-600 p-3 rounded border border-indigo-200 dark:border-indigo-700/50">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Día de la semana
                      </label>
                      <div className="grid grid-cols-7 gap-1">
                        {[
                          { value: 0, label: 'D', full: 'Domingo' },
                          { value: 1, label: 'L', full: 'Lunes' },
                          { value: 2, label: 'M', full: 'Martes' },
                          { value: 3, label: 'X', full: 'Miércoles' },
                          { value: 4, label: 'J', full: 'Jueves' },
                          { value: 5, label: 'V', full: 'Viernes' },
                          { value: 6, label: 'S', full: 'Sábado' },
                        ].map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => setRecurrenceWeekday(day.value)}
                            className={`px-2 py-2 text-sm font-medium rounded transition ${
                              recurrenceWeekday === day.value
                                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                            title={day.full}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Posición en el mes
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { value: 1, label: 'Primer' },
                          { value: 2, label: 'Segundo' },
                          { value: 3, label: 'Tercer' },
                          { value: 4, label: 'Cuarto' },
                          { value: -1, label: 'Último' },
                        ].map((pos) => (
                          <button
                            key={pos.value}
                            type="button"
                            onClick={() => setRecurrenceWeekPosition(pos.value)}
                            className={`px-3 py-2 text-sm font-medium rounded transition ${
                              recurrenceWeekPosition === pos.value
                                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                      {recurrenceWeekday !== null && recurrenceWeekPosition !== null && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          La tarea será el{' '}
                          {recurrenceWeekPosition === -1 ? 'último' : ['', 'primer', 'segundo', 'tercer', 'cuarto'][recurrenceWeekPosition]}{' '}
                          {['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][recurrenceWeekday]} de cada mes
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {recurrenceType !== 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Intervalo
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Cada X días/semanas"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Cada {recurrenceInterval} {recurrenceType === 'daily' ? 'día(s)' : 'semana(s)'}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fecha de fin <span className="text-gray-400 dark:text-gray-500 text-xs">(Opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    min={dueDate.split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Dejar vacío para recurrencia infinita
                  </p>
                </div>
              </div>
            )}
          </div>

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
              className={`px-6 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                isPersonal ? 'bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-600' : 'bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600'
              }`}
            >
              {(loading || uploading) && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {loading ? 'Creando...' : uploading ? 'Subiendo archivos...' : isPersonal ? 'Crear Tarea Personal' : 'Crear Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

