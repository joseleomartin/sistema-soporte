import { useState, useEffect } from 'react';
import { X, Users, CheckSquare, Search, Save, FolderOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Subforum {
  id: string;
  name: string;
  client_name: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface BulkAssignUsersModalProps {
  subforums: Subforum[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkAssignUsersModal({
  subforums,
  onClose,
  onSuccess,
}: BulkAssignUsersModalProps) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [clientUserAssignments, setClientUserAssignments] = useState<Map<string, Set<string>>>(new Map());
  const [existingPermissions, setExistingPermissions] = useState<Map<string, Set<string>>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [subforums]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar usuarios
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'user')
        .order('full_name');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Cargar permisos existentes para todos los clientes
      // Dividir en lotes para evitar límites de Supabase y asegurar carga completa
      const clientIds = subforums.map(s => s.id);
      if (clientIds.length > 0) {
        const permsMap = new Map<string, Set<string>>();
        
        // Dividir clientIds en lotes de 100 para evitar límites de Supabase
        const batchSize = 100;
        const batches: string[][] = [];
        for (let i = 0; i < clientIds.length; i += batchSize) {
          batches.push(clientIds.slice(i, i + batchSize));
        }

        // Cargar permisos por lotes con un pequeño delay entre cada lote
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          
          // Pequeño delay entre lotes para no sobrecargar
          if (batchIndex > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          let from = 0;
          const pageSize = 1000;
          let hasMore = true;

          // Cargar todos los permisos de este lote usando paginación
          while (hasMore) {
            const { data: permsData, error: permsError } = await supabase
              .from('subforum_permissions')
              .select('subforum_id, user_id')
              .in('subforum_id', batch)
              .eq('can_view', true)
              .range(from, from + pageSize - 1);

            if (permsError) throw permsError;

            if (permsData && permsData.length > 0) {
              permsData.forEach((perm) => {
                if (!permsMap.has(perm.subforum_id)) {
                  permsMap.set(perm.subforum_id, new Set());
                }
                permsMap.get(perm.subforum_id)!.add(perm.user_id);
              });

              // Si obtuvimos menos registros que el tamaño de página, no hay más
              hasMore = permsData.length === pageSize;
              from += pageSize;
            } else {
              hasMore = false;
            }
          }
        }

        setExistingPermissions(permsMap);
        
        // Crear una copia profunda para clientUserAssignments
        // Esto refleja el estado actual de los permisos en la base de datos
        const assignmentsMap = new Map<string, Set<string>>();
        permsMap.forEach((userSet, clientId) => {
          assignmentsMap.set(clientId, new Set(userSet));
        });
        setClientUserAssignments(assignmentsMap);
        
        // Limpiar selecciones de usuarios y clientes para reflejar el estado actual
        setSelectedUsers(new Set());
        setSelectedClients(new Set());
        
        // Pequeño delay adicional para asegurar que todo esté sincronizado
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const toggleUserAssignment = (clientId: string, userId: string) => {
    setClientUserAssignments((prev) => {
      const newMap = new Map(prev);
      if (!newMap.has(clientId)) {
        newMap.set(clientId, new Set());
      }
      const userSet = newMap.get(clientId)!;
      if (userSet.has(userId)) {
        userSet.delete(userId);
        // Si el Set queda vacío, mantenerlo vacío (no eliminarlo del Map)
        // Esto permite que la comparación funcione correctamente
      } else {
        userSet.add(userId);
      }
      // Crear un nuevo Set para forzar la actualización del estado
      newMap.set(clientId, new Set(userSet));
      return newMap;
    });
  };

  const assignClientToSelectedUsers = (clientId: string) => {
    setClientUserAssignments((prev) => {
      const newMap = new Map(prev);
      if (!newMap.has(clientId)) {
        newMap.set(clientId, new Set());
      }
      const userSet = newMap.get(clientId)!;
      selectedUsers.forEach((userId) => {
        userSet.add(userId);
      });
      // Crear un nuevo Set para forzar la actualización del estado
      newMap.set(clientId, new Set(userSet));
      return newMap;
    });
  };

  const removeClientFromSelectedUsers = (clientId: string) => {
    setClientUserAssignments((prev) => {
      const newMap = new Map(prev);
      if (!newMap.has(clientId)) {
        newMap.set(clientId, new Set());
      }
      const userSet = newMap.get(clientId)!;
      selectedUsers.forEach((userId) => {
        userSet.delete(userId);
      });
      // Crear un nuevo Set para forzar la actualización del estado
      newMap.set(clientId, new Set(userSet));
      return newMap;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Para cada cliente, actualizar sus permisos
      const updates: Promise<any>[] = [];
      let totalChanges = 0;

      for (const client of subforums) {
        const currentAssignments = clientUserAssignments.get(client.id) || new Set();
        const existingAssignments = existingPermissions.get(client.id) || new Set();

        // Convertir a arrays para comparar correctamente
        const currentArray = Array.from(currentAssignments);
        const existingArray = Array.from(existingAssignments);

        // Determinar qué agregar y qué eliminar
        const toAdd = currentArray.filter(
          (userId) => !existingArray.includes(userId)
        );
        const toRemove = existingArray.filter(
          (userId) => !currentArray.includes(userId)
        );

        console.log(`Cliente ${client.name}:`, {
          current: currentArray,
          existing: existingArray,
          toAdd,
          toRemove
        });

        // Eliminar permisos que ya no están
        if (toRemove.length > 0) {
          totalChanges += toRemove.length;
          for (const userId of toRemove) {
            const deletePromise = supabase
              .from('subforum_permissions')
              .delete()
              .eq('subforum_id', client.id)
              .eq('user_id', userId)
              .then((result) => {
                if (result.error) {
                  console.error(`Error eliminando permiso para cliente ${client.id}, usuario ${userId}:`, result.error);
                  throw result.error;
                }
                console.log(`✅ Permiso eliminado: cliente ${client.id}, usuario ${userId}`);
                return result;
              });
            updates.push(deletePromise);
          }
        }

        // Agregar nuevos permisos
        if (toAdd.length > 0) {
          totalChanges += toAdd.length;
          const newPerms = toAdd.map((userId) => ({
            subforum_id: client.id,
            user_id: userId,
            can_view: true,
            can_post: true,
            can_moderate: false,
          }));

          // Usar upsert para evitar errores de duplicados
          // Si el permiso ya existe, se actualiza; si no, se crea
          const insertPromise = supabase
            .from('subforum_permissions')
            .upsert(newPerms, {
              onConflict: 'subforum_id,user_id'
            })
            .then((result) => {
              if (result.error) {
                // Si el error es de duplicado, lo ignoramos (puede pasar en operaciones concurrentes)
                if (result.error.code === '23505' || result.error.message?.includes('duplicate')) {
                  console.log(`⚠️ Algunos permisos ya existían para cliente ${client.id}, se ignoran`);
                  return result; // No lanzar error, solo continuar
                }
                console.error(`Error insertando permisos para cliente ${client.id}:`, result.error);
                throw result.error;
              }
              console.log(`✅ Permisos agregados: cliente ${client.id}, usuarios:`, toAdd);
              return result;
            });
          updates.push(insertPromise);
        }
      }

      if (updates.length === 0) {
        alert('No hay cambios para guardar');
        setSaving(false);
        return;
      }

      console.log(`Guardando ${updates.length} operaciones...`);
      await Promise.all(updates);
      console.log(`✅ Guardado exitoso: ${totalChanges} cambios aplicados`);
      
      // Recargar datos para reflejar los cambios
      await loadData();
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Error al guardar permisos: ' + ((error as any)?.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClients = subforums.filter(
    (client) =>
      client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.client_name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  const selectedUsersList = users.filter((u) => selectedUsers.has(u.id));
  const selectedClientsList = subforums.filter((s) => selectedClients.has(s.id));

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Asignación Masiva de Usuarios</h2>
            <p className="text-sm text-gray-500 mt-1">
              Selecciona múltiples clientes y asigna usuarios de manera rápida
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Panel Izquierdo: Selección de Usuarios */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">Seleccionar Usuarios</h3>
              <div className="text-xs text-gray-500 mb-2">
                {selectedUsers.size} de {users.length} seleccionados
              </div>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => {
                    if (selectedUsers.size === users.length) {
                      setSelectedUsers(new Set());
                    } else {
                      setSelectedUsers(new Set(users.map(u => u.id)));
                    }
                  }}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                >
                  {selectedUsers.size === users.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar usuarios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredUsers.map((user) => {
                const assignedClients = subforums.filter((client) => {
                  const assignments = clientUserAssignments.get(client.id) || new Set();
                  return assignments.has(user.id);
                });

                return (
                  <label
                    key={user.id}
                    className={`flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer border ${
                      selectedUsers.has(user.id) ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{user.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      {assignedClients.length > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          {assignedClients.length} cliente{assignedClients.length !== 1 ? 's' : ''} asignado{assignedClients.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Panel Derecho: Asignación de Clientes */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">Asignar Clientes</h3>
              {selectedUsers.size > 0 ? (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-2">
                    Usuarios seleccionados: {selectedUsersList.map(u => u.full_name).join(', ')}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        filteredClients.forEach(client => assignClientToSelectedUsers(client.id));
                      }}
                      className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition"
                    >
                      Asignar todos a seleccionados
                    </button>
                    <button
                      onClick={() => {
                        filteredClients.forEach(client => removeClientFromSelectedUsers(client.id));
                      }}
                      className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                    >
                      Quitar todos de seleccionados
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Selecciona al menos un usuario para asignar clientes
                </p>
              )}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar clientes..."
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredClients.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No se encontraron clientes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredClients.map((client) => {
                    // Contar directamente el número de usuarios asignados desde el Set
                    const assignments = clientUserAssignments.get(client.id) || new Set();
                    const assignedCount = assignments.size;

                    return (
                      <div
                        key={client.id}
                        className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{client.name}</p>
                            <p className="text-xs text-gray-500">{client.client_name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedUsers.size > 0 && (
                              <>
                                <button
                                  onClick={() => assignClientToSelectedUsers(client.id)}
                                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                                  title="Asignar a usuarios seleccionados"
                                >
                                  + Seleccionados
                                </button>
                                <button
                                  onClick={() => removeClientFromSelectedUsers(client.id)}
                                  className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                                  title="Quitar de usuarios seleccionados"
                                >
                                  - Seleccionados
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {filteredUsers.map((user) => {
                            const isAssigned = (clientUserAssignments.get(client.id) || new Set()).has(user.id);
                            const isSelected = selectedUsers.has(user.id);
                            
                            return (
                              <label
                                key={user.id}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition ${
                                  isAssigned
                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                    : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                                } ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => toggleUserAssignment(client.id, user.id)}
                                  className="w-3 h-3 text-green-600 rounded focus:ring-1 focus:ring-green-500"
                                />
                                <span className="truncate max-w-[120px]">{user.full_name}</span>
                              </label>
                            );
                          })}
                        </div>
                        {assignedCount > 0 && (
                          <p className="text-xs text-gray-500 mt-2">
                            Asignado a {assignedCount} usuario{assignedCount !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {Array.from(clientUserAssignments.values()).reduce((acc, set) => acc + set.size, 0)} asignaciones en total
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

