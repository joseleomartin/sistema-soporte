import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Users, User, Paperclip, FileText, Image, File } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CreateTaskModalProps {
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

export function CreateTaskModal({ onClose, onSuccess }: CreateTaskModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'urgent'>('medium');
  // Usuarios no-admin solo pueden crear tareas personales
  const [isPersonal, setIsPersonal] = useState(profile?.role !== 'admin');
  const [assignmentType, setAssignmentType] = useState<'user' | 'department'>('user');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [taskManagerId, setTaskManagerId] = useState('');
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
      return <File className="w-5 h-5 text-gray-600" />;
    }
  };

  const uploadFiles = async (taskId: string) => {
    if (selectedFiles.length === 0 || !profile?.id) return;

    setUploading(true);
    try {
      // Crear un mensaje automático para los archivos iniciales
      const { data: messageData, error: messageError } = await supabase
        .from('task_messages')
        .insert([
          {
            task_id: taskId,
            user_id: profile.id,
            message: selectedFiles.length === 1 
              ? `📎 ${selectedFiles[0].name}` 
              : `📎 ${selectedFiles.length} archivos adjuntos`
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
              uploaded_by: profile.id
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

    try {
      setLoading(true);
      setError('');

      // Preparar patrón de recurrencia si es necesario
      const recurrencePattern = isRecurring ? {
        type: recurrenceType,
        interval: recurrenceInterval,
        end_date: recurrenceEndDate || null
      } : null;

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
            task_manager_id: (!isPersonal && taskManagerId) ? taskManagerId : null,
            is_recurring: isRecurring,
            recurrence_pattern: recurrencePattern,
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
              assigned_by: profile.id
            });
          }
        } else {
          // Crear una asignación para el departamento
          assignments.push({
            task_id: taskData.id,
            assigned_to_department: selectedDepartmentId,
            assigned_by: profile.id
          });
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Nueva Tarea</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Título de la tarea"
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Descripción detallada de la tarea"
              required
            />
          </div>

          {/* Archivos Adjuntos (Opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archivos Adjuntos <span className="text-gray-400 text-xs">(Opcional)</span>
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
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 text-gray-600"
            >
              <Paperclip className="w-5 h-5" />
              <span>Seleccionar archivos</span>
            </button>
            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente <span className="text-gray-400 text-xs">(Opcional)</span>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Escribe o selecciona un cliente"
              />
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setClientName('');
                      setClientNameInput('');
                      setShowClientDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-500"
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
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm text-gray-900"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha y Hora Límite <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Prioridad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prioridad <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPriority('low')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  priority === 'low'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  <div className="w-4 h-4 rounded-full bg-green-500 mx-auto mb-2"></div>
                  <span className="text-sm font-medium text-gray-900">Baja</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPriority('medium')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  priority === 'medium'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  <div className="w-4 h-4 rounded-full bg-blue-500 mx-auto mb-2"></div>
                  <span className="text-sm font-medium text-gray-900">Media</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPriority('urgent')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  priority === 'urgent'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  <div className="w-4 h-4 rounded-full bg-red-500 mx-auto mb-2"></div>
                  <span className="text-sm font-medium text-gray-900">Urgente</span>
                </div>
              </button>
            </div>
          </div>

          {/* Tarea Personal */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
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
                className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">Tarea Personal</span>
                <p className="text-xs text-gray-600 mt-1">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asignar a <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setAssignmentType('user')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  assignmentType === 'user'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <User className="w-5 h-5" />
                <span className="font-medium">Usuario Individual</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('department')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  assignmentType === 'department'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="font-medium">Área</span>
              </button>
            </div>

            {/* Selector de Usuarios Múltiples */}
            {assignmentType === 'user' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Selecciona uno o más usuarios:</p>
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-white">
                  {users.length === 0 ? (
                    <p className="text-gray-500 text-sm">No hay usuarios disponibles</p>
                  ) : (
                    users.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-2 hover:bg-indigo-50 rounded cursor-pointer transition-colors"
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
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {selectedUserIds.length > 0 && (
                  <p className="text-sm text-indigo-600 font-medium">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Administrador de Tarea <span className="text-gray-400 text-xs">(Opcional)</span>
            </label>
            <select
              value={taskManagerId}
              onChange={(e) => setTaskManagerId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Sin administrador</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} {user.role === 'admin' ? '(Admin)' : user.role === 'support' ? '(Soporte)' : '(Usuario)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              El administrador puede cambiar el estado de la tarea. Puede ser cualquier usuario.
            </p>
          </div>
          )}

          {/* Tarea Recurrente */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Tarea recurrente</span>
            </label>
            {isRecurring && (
              <div className="mt-4 space-y-4 pl-7">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de recurrencia
                  </label>
                  <select
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value as 'daily' | 'weekly' | 'monthly')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="daily">Diaria</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Intervalo
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Cada X días/semanas/meses"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cada {recurrenceInterval} {recurrenceType === 'daily' ? 'día(s)' : recurrenceType === 'weekly' ? 'semana(s)' : 'mes(es)'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de fin <span className="text-gray-400 text-xs">(Opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    min={dueDate.split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Dejar vacío para recurrencia infinita
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className={`px-6 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                isPersonal ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'
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

