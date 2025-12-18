import { useEffect, useState, useRef } from 'react';
import { User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
}

interface TaskMentionAutocompleteProps {
  taskId: string;
  searchTerm: string;
  cursorPosition: number;
  selectedIndex?: number;
  onSelect: (user: User) => void;
  onClose: () => void;
  onNavigate?: (direction: 'up' | 'down', maxIndex: number) => void;
}

export function TaskMentionAutocomplete({
  taskId,
  searchTerm,
  cursorPosition,
  selectedIndex: externalSelectedIndex,
  onSelect,
  onClose,
  onNavigate,
}: TaskMentionAutocompleteProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Usar índice externo si se proporciona, de lo contrario usar el interno
  const selectedIndex = externalSelectedIndex !== undefined ? externalSelectedIndex : internalSelectedIndex;

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        // Obtener usuarios asignados a la tarea
        const { data: assignmentsData, error: assignError } = await supabase
          .from('task_assignments')
          .select(`
            assigned_to_user,
            profiles:assigned_to_user (
              id,
              full_name,
              email,
              role,
              avatar_url
            )
          `)
          .eq('task_id', taskId)
          .not('assigned_to_user', 'is', null);

        if (assignError) throw assignError;

        // Obtener todos los administradores (admin y support)
        const { data: adminsData, error: adminsError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, avatar_url')
          .in('role', ['admin', 'support']);

        if (adminsError) throw adminsError;

        // Extraer usuarios únicos (asignados + administradores)
        const userMap = new Map<string, User>();
        
        // Agregar usuarios asignados
        assignmentsData?.forEach((assignment: any) => {
          if (assignment.profiles) {
            const user = assignment.profiles;
            if (!userMap.has(user.id)) {
              userMap.set(user.id, user);
            }
          }
        });

        // Agregar administradores
        adminsData?.forEach((admin: User) => {
          if (!userMap.has(admin.id)) {
            userMap.set(admin.id, admin);
          }
        });

        let allUsers = Array.from(userMap.values());

        // Si hay término de búsqueda, filtrar usuarios
        if (searchTerm.trim()) {
          allUsers = allUsers.filter(
            (user: User) =>
              user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              user.email.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        setUsers(allUsers.slice(0, 10)); // Limitar a 10 resultados
        if (externalSelectedIndex === undefined) {
          setInternalSelectedIndex(0);
        }
      } catch (error) {
        console.error('Error fetching task users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchUsers, 200);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, taskId]);

  useEffect(() => {
    // Scroll al elemento seleccionado
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (onNavigate) {
        onNavigate('down', users.length - 1);
      } else {
        setInternalSelectedIndex((prev) => (prev < users.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (onNavigate) {
        onNavigate('up', users.length - 1);
      } else {
        setInternalSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (users[selectedIndex]) {
        onSelect(users[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (users.length === 0 && !loading) {
    return null;
  }

  return (
    <div
      className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto task-dropdown-scroll"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      <div ref={listRef} className="py-1">
        {loading ? (
          <div className="px-4 py-2 text-sm text-gray-500">Buscando usuarios...</div>
        ) : (
          users.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelect(user)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-blue-50 transition ${
                index === selectedIndex ? 'bg-blue-50' : ''
              }`}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  user.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : user.role === 'support'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {user.role === 'admin'
                  ? 'Admin'
                  : user.role === 'support'
                  ? 'Soporte'
                  : 'Usuario'}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

