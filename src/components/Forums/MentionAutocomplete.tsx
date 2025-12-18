import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
}

interface MentionAutocompleteProps {
  subforumId: string;
  searchTerm: string;
  cursorPosition: number;
  selectedIndex?: number;
  onSelect: (user: User) => void;
  onClose: () => void;
  onNavigate?: (direction: 'up' | 'down', maxIndex: number) => void;
}

export function MentionAutocomplete({
  subforumId,
  searchTerm,
  cursorPosition,
  selectedIndex: externalSelectedIndex,
  onSelect,
  onClose,
  onNavigate,
}: MentionAutocompleteProps) {
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
        // Llamar a la función RPC para obtener usuarios con acceso
        const { data, error } = await supabase.rpc('get_subforum_accessible_users', {
          p_subforum_id: subforumId,
        });

        if (error) throw error;

        // Si hay término de búsqueda, filtrar usuarios
        // Si no hay término, mostrar todos los usuarios disponibles
        const filtered = searchTerm.trim()
          ? (data || []).filter(
              (user: User) =>
                user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase())
            )
          : (data || []);

        setUsers(filtered.slice(0, 10)); // Limitar a 10 resultados
        if (externalSelectedIndex === undefined) {
          setInternalSelectedIndex(0);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchUsers, 200);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, subforumId]);

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

  // Exponer función para seleccionar usuario actual (para uso desde textarea)
  useEffect(() => {
    if (users.length > 0 && selectedIndex >= 0 && selectedIndex < users.length) {
      // Esta función se puede llamar desde el componente padre
      (window as any).__mentionAutocompleteSelect = () => {
        if (users[selectedIndex]) {
          onSelect(users[selectedIndex]);
        }
      };
    } else {
      delete (window as any).__mentionAutocompleteSelect;
    }
    return () => {
      delete (window as any).__mentionAutocompleteSelect;
    };
  }, [users, selectedIndex, onSelect]);

  if (users.length === 0 && !loading) {
    return null;
  }

  return (
    <div
      className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto forums-scroll"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      <div ref={listRef} className="py-1">
        {loading ? (
          <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Buscando usuarios...</div>
        ) : (
          users.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelect(user)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-700 transition ${
                index === selectedIndex ? 'bg-blue-50 dark:bg-slate-700' : ''
              }`}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  user.role === 'admin'
                    ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                    : user.role === 'support'
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
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



