import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Search, Check } from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Permission {
  user_id: string;
  can_view: boolean;
  can_post: boolean;
  can_moderate: boolean;
}

interface ManagePermissionsModalProps {
  subforumId: string;
  subforumName: string;
  onClose: () => void;
}

export function ManagePermissionsModal({
  subforumId,
  subforumName,
  onClose,
}: ManagePermissionsModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Map<string, Permission>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [subforumId]);

  const loadData = async () => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'user')
        .order('full_name');

      if (usersError) throw usersError;

      const { data: permsData, error: permsError } = await supabase
        .from('subforum_permissions')
        .select('*')
        .eq('subforum_id', subforumId);

      if (permsError) throw permsError;

      setUsers(usersData || []);

      const permsMap = new Map<string, Permission>();
      (permsData || []).forEach((perm) => {
        permsMap.set(perm.user_id, {
          user_id: perm.user_id,
          can_view: perm.can_view,
          can_post: perm.can_post,
          can_moderate: perm.can_moderate,
        });
      });
      setPermissions(permsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (
    userId: string,
    field: 'can_view' | 'can_post' | 'can_moderate'
  ) => {
    setPermissions((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(userId) || {
        user_id: userId,
        can_view: false,
        can_post: false,
        can_moderate: false,
      };

      const updated = { ...current, [field]: !current[field] };

      if (field === 'can_post' && updated.can_post && !updated.can_view) {
        updated.can_view = true;
      }
      if (field === 'can_moderate' && updated.can_moderate && !updated.can_view) {
        updated.can_view = true;
      }

      newMap.set(userId, updated);
      return newMap;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('subforum_permissions')
        .delete()
        .eq('subforum_id', subforumId);

      if (deleteError) throw deleteError;

      const permsToInsert = Array.from(permissions.values())
        .filter((p) => p.can_view || p.can_post || p.can_moderate)
        .map((p) => ({
          subforum_id: subforumId,
          user_id: p.user_id,
          can_view: p.can_view,
          can_post: p.can_post,
          can_moderate: p.can_moderate,
        }));

      if (permsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('subforum_permissions')
          .insert(permsToInsert);

        if (insertError) throw insertError;
      }

      onClose();
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Error al guardar permisos');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestionar Permisos</h2>
            <p className="text-gray-600 mt-1">{subforumName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const perm = permissions.get(user.id) || {
                  user_id: user.id,
                  can_view: false,
                  can_post: false,
                  can_moderate: false,
                };

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {user.full_name}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    </div>

                    <div className="flex items-center gap-4 ml-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={perm.can_view}
                          onChange={() => togglePermission(user.id, 'can_view')}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Ver</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={perm.can_post}
                          onChange={() => togglePermission(user.id, 'can_post')}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Publicar</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={perm.can_moderate}
                          onChange={() => togglePermission(user.id, 'can_moderate')}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Moderar</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              'Guardando...'
            ) : (
              <>
                <Check className="w-5 h-5" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
