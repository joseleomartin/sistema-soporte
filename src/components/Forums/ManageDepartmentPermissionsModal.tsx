import { useState, useEffect } from 'react';
import { X, Building2, CheckCircle, AlertCircle, Eye, MessageSquare, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ManageDepartmentPermissionsModalProps {
  forumId: string;
  forumName: string;
  onClose: () => void;
}

interface Department {
  id: string;
  name: string;
  color: string;
}

interface Permission {
  department_id: string;
  can_view: boolean;
  can_post: boolean;
  can_moderate: boolean;
}

export function ManageDepartmentPermissionsModal({
  forumId,
  forumName,
  onClose
}: ManageDepartmentPermissionsModalProps) {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [permissions, setPermissions] = useState<Map<string, Permission>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [forumId]);

  const loadData = async () => {
    try {
      // Cargar departamentos
      const { data: deptsData } = await supabase
        .from('departments')
        .select('id, name, color')
        .order('name');

      // Cargar permisos existentes
      const { data: permsData } = await supabase
        .from('department_forum_permissions')
        .select('department_id, can_view, can_post, can_moderate')
        .eq('forum_id', forumId);

      setDepartments(deptsData || []);

      const permsMap = new Map<string, Permission>();
      permsData?.forEach(perm => {
        permsMap.set(perm.department_id, perm);
      });
      setPermissions(permsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (deptId: string, permType: 'can_view' | 'can_post' | 'can_moderate') => {
    setPermissions(prev => {
      const newMap = new Map(prev);
      const currentPerm = newMap.get(deptId) || {
        department_id: deptId,
        can_view: false,
        can_post: false,
        can_moderate: false
      };

      // Si se desmarca can_view, desmarcar también can_post y can_moderate
      if (permType === 'can_view' && currentPerm.can_view) {
        newMap.set(deptId, {
          ...currentPerm,
          can_view: false,
          can_post: false,
          can_moderate: false
        });
      } else {
        // Si se marca can_post o can_moderate, marcar automáticamente can_view
        if ((permType === 'can_post' || permType === 'can_moderate') && !currentPerm.can_view) {
          newMap.set(deptId, {
            ...currentPerm,
            can_view: true,
            [permType]: !currentPerm[permType]
          });
        } else {
          newMap.set(deptId, {
            ...currentPerm,
            [permType]: !currentPerm[permType]
          });
        }
      }

      return newMap;
    });
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    setSaving(true);
    setMessage(null);

    try {
      // Eliminar todos los permisos existentes para este foro
      await supabase
        .from('department_forum_permissions')
        .delete()
        .eq('forum_id', forumId);

      // Insertar nuevos permisos
      const permsToInsert = Array.from(permissions.entries())
        .filter(([_, perm]) => perm.can_view || perm.can_post || perm.can_moderate)
        .map(([deptId, perm]) => ({
          department_id: deptId,
          forum_id: forumId,
          can_view: perm.can_view,
          can_post: perm.can_post,
          can_moderate: perm.can_moderate,
          granted_by: profile.id
        }));

      if (permsToInsert.length > 0) {
        const { error } = await supabase
          .from('department_forum_permissions')
          .insert(permsToInsert);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Permisos actualizados correctamente' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      setMessage({ type: 'error', text: error.message || 'Error al guardar permisos' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Permisos por Departamento</h2>
            <p className="text-sm text-gray-600 mt-1">Cliente: {forumName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {message && (
          <div className={`mx-6 mt-4 rounded-lg p-3 flex items-start gap-2 ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {message.text}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No hay departamentos creados</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Todos los usuarios asignados a un departamento con permisos tendrán acceso automático a este cliente.
                </p>
              </div>

              {departments.map((dept) => {
                const perm = permissions.get(dept.id) || {
                  department_id: dept.id,
                  can_view: false,
                  can_post: false,
                  can_moderate: false
                };

                return (
                  <div
                    key={dept.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: dept.color }}
                      />
                      <h3 className="font-medium text-gray-900">{dept.name}</h3>
                    </div>

                    <div className="grid grid-cols-3 gap-3 ml-7">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={perm.can_view}
                          onChange={() => togglePermission(dept.id, 'can_view')}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">
                            Ver
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={perm.can_post}
                          onChange={() => togglePermission(dept.id, 'can_post')}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">
                            Publicar
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={perm.can_moderate}
                          onChange={() => togglePermission(dept.id, 'can_moderate')}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">
                            Moderar
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}














