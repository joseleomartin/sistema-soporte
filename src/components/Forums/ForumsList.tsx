import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { Plus, FolderOpen, Users, Search, Settings, FileText, Image, File, Building2, CheckSquare, AlertCircle, X, Calendar, Filter, ArrowUpDown, ArrowUp, ArrowDown, Star, FileSpreadsheet, Grid3x3, List, Download, Clock, CheckCircle2, Loader2, Layers } from 'lucide-react';
import { writeFile, utils } from 'xlsx';
import { CreateForumModal } from './CreateForumModal';
import { SubforumChat } from './SubforumChat';
import { ManagePermissionsModal } from './ManagePermissionsModal';
import { ClientFilesModal } from './ClientFilesModal';
import { ManageDepartmentPermissionsModal } from './ManageDepartmentPermissionsModal';
import { BulkAssignUsersModal } from './BulkAssignUsersModal';
import { EditClientModal } from './EditClientModal';
import { ClientInfoModal } from './ClientInfoModal';
import { BulkImportClientsModal } from './BulkImportClientsModal';
import { CreateTaskModal } from '../Tasks/CreateTaskModal';
import { CreateVencimientoModal } from '../Vencimientos/CreateVencimientoModal';

interface Subforum {
  id: string;
  name: string;
  description: string | null;
  client_name: string;
  cuit?: string | null;
  email?: string | null;
  access_keys?: string | null;
  economic_link?: string | null;
  contact_full_name?: string | null;
  client_type?: string | null;
  phone?: string | null;
  forum_id: string;
  created_at: string;
  message_count?: number;
  is_favorite?: boolean;
  vencimientos_tipos?: string[] | null;
  vencimientos_responsable_id?: string | null;
}

interface ForumsListProps {
  initialSubforumId?: string | null;
  onSubforumChange?: (subforumId: string | null) => void;
}

export function ForumsList({ initialSubforumId, onSubforumChange }: ForumsListProps = {}) {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const [subforums, setSubforums] = useState<Subforum[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSubforum, setSelectedSubforum] = useState<string | null>(initialSubforumId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [managePermissionsFor, setManagePermissionsFor] = useState<Subforum | null>(null);
  const [manageDeptPermissionsFor, setManageDeptPermissionsFor] = useState<{ forumId: string, forumName: string } | null>(null);
  const [showFilesFor, setShowFilesFor] = useState<Subforum | null>(null);
  const [pendingTasksCount, setPendingTasksCount] = useState<Map<string, number>>(new Map());
  const [showPendingTasksModal, setShowPendingTasksModal] = useState<{ clientName: string; tasks: any[] } | null>(null);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkAssignModalKey, setBulkAssignModalKey] = useState(0);
  const [editClientFor, setEditClientFor] = useState<Subforum | null>(null);
  const [showClientInfoFor, setShowClientInfoFor] = useState<Subforum | null>(null);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [pendingVencimientosCount, setPendingVencimientosCount] = useState<Map<string, number>>(new Map());
  const [showVencimientosModal, setShowVencimientosModal] = useState<{ clientName: string; clientCuit: string; vencimientos: any[] } | null>(null);
  const [showCreateTaskFromVencimiento, setShowCreateTaskFromVencimiento] = useState<{ clientName: string; vencimiento: any } | null>(null);
  const [showCreateVencimientoFromVencimiento, setShowCreateVencimientoFromVencimiento] = useState<{ clientName: string; clientCuit: string; vencimiento: any } | null>(null);
  const [selectedVencimientosForBulk, setSelectedVencimientosForBulk] = useState<Set<string>>(new Set());
  const [creatingBulk, setCreatingBulk] = useState(false);
  
  // Filtros
  const [sortBy, setSortBy] = useState<'alphabetical' | 'activity' | 'none'>('alphabetical');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterByTasks, setFilterByTasks] = useState<'all' | 'with_tasks' | 'without_tasks'>('all');
  const [filterByFavorites, setFilterByFavorites] = useState<boolean>(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('clientsViewMode');
    return (saved === 'grid' || saved === 'list') ? saved : 'grid';
  });

  const canCreateForum = profile?.role === 'admin' || profile?.role === 'support';

  // Función para exportar todos los clientes a Excel
  const exportClientsToExcel = async () => {
    if (!tenantId) {
      alert('Error: No se pudo identificar la empresa');
      return;
    }

    try {
      // Obtener todos los subforums del tenant
      const { data: allSubforums, error } = await supabase
        .from('subforums')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('client_name', { ascending: true });

      if (error) throw error;

      if (!allSubforums || allSubforums.length === 0) {
        alert('No hay clientes para exportar');
        return;
      }

      // Obtener todos los drive mappings de una vez
      const subforumIds = allSubforums.map(s => s.id);
      const query = supabase
        .from('client_drive_mapping')
        .select('subforum_id, folder_link, google_drive_folder_id')
        .in('subforum_id', subforumIds);
      
      // Filtrar por tenant_id si existe en la tabla
      if (tenantId) {
        query.eq('tenant_id', tenantId);
      }
      
      const { data: driveMappings, error: driveError } = await query;
      
      if (driveError) {
        console.warn('Error obteniendo drive mappings:', driveError);
      }

      // Crear un mapa para acceso rápido
      const driveLinkMap = new Map<string, string>();
      driveMappings?.forEach((mapping: any) => {
        // Usar folder_link si existe, sino construir desde google_drive_folder_id
        if (mapping.folder_link) {
          driveLinkMap.set(mapping.subforum_id, mapping.folder_link);
        } else if (mapping.google_drive_folder_id) {
          // Construir el link desde el folder_id
          driveLinkMap.set(mapping.subforum_id, `https://drive.google.com/drive/folders/${mapping.google_drive_folder_id}`);
        }
      });

      // Preparar los datos en el formato de la plantilla de importación
      const exportData = allSubforums.map((subforum) => {
        // Parsear access_keys si existen
        let arcaUser = '';
        let arcaPassword = '';
        let agipUser = '';
        let agipPassword = '';
        let arbaUser = '';
        let arbaPassword = '';

        if (subforum.access_keys) {
          try {
            const accessKeys = typeof subforum.access_keys === 'string' 
              ? JSON.parse(subforum.access_keys) 
              : subforum.access_keys;
            
            if (accessKeys.arca) {
              arcaUser = accessKeys.arca.usuario || '';
              arcaPassword = accessKeys.arca.contraseña || '';
            }
            if (accessKeys.agip) {
              agipUser = accessKeys.agip.usuario || '';
              agipPassword = accessKeys.agip.contraseña || '';
            }
            if (accessKeys.armba) {
              arbaUser = accessKeys.armba.usuario || '';
              arbaPassword = accessKeys.armba.contraseña || '';
            }
          } catch (e) {
            console.error('Error parsing access_keys:', e);
          }
        }

        // Separar email y phone si están combinados
        let email1 = '';
        let email2 = '';
        if (subforum.email) {
          const emails = subforum.email.split(' / ').map(e => e.trim());
          email1 = emails[0] || '';
          email2 = emails[1] || '';
        }

        let phone1 = '';
        let phone2 = '';
        if (subforum.phone) {
          const phones = subforum.phone.split(' / ').map(p => p.trim());
          phone1 = phones[0] || '';
          phone2 = phones[1] || '';
        }

        // Obtener el link de Google Drive del mapa
        const driveLink = driveLinkMap.get(subforum.id) || '';

        return [
          subforum.name || subforum.client_name || '', // Nombre espacio de trabajo
          subforum.client_name || '', // Nombre del cliente
          subforum.description || '', // Descripción
          subforum.cuit || '', // CUIT
          email1, // Email 1
          email2, // Email 2
          phone1, // Teléfono 1
          phone2, // Teléfono 2
          subforum.economic_link || '', // Vinculación económica
          subforum.contact_full_name || '', // Nombre de contacto
          subforum.client_type || '', // Tipo de cliente
          arcaUser, // Usuario ARCA
          arcaPassword, // Contraseña ARCA
          agipUser, // Usuario AGIP
          agipPassword, // Contraseña AGIP
          arbaUser, // Usuario ARBA
          arbaPassword, // Contraseña ARBA
          driveLink, // Link carpeta Google Drive
        ];
      });

      // Encabezados (mismo formato que la plantilla de importación)
      const headers = [
        'Nombre espacio de trabajo',
        'Nombre del cliente',
        'Descripción',
        'CUIT',
        'Email 1',
        'Email 2',
        'Teléfono 1',
        'Teléfono 2',
        'Vinculación económica',
        'Nombre de contacto',
        'Tipo de cliente',
        'Usuario ARCA',
        'Contraseña ARCA',
        'Usuario AGIP',
        'Contraseña AGIP',
        'Usuario ARBA',
        'Contraseña ARBA',
        'Link carpeta Google Drive',
      ];

      // Crear el workbook
      const wb = utils.book_new();
      const ws = utils.aoa_to_sheet([headers, ...exportData]);

      // Ajustar el ancho de las columnas
      const colWidths = [
        { wch: 25 }, // Nombre espacio de trabajo
        { wch: 25 }, // Nombre del cliente
        { wch: 30 }, // Descripción
        { wch: 15 }, // CUIT
        { wch: 25 }, // Email 1
        { wch: 25 }, // Email 2
        { wch: 15 }, // Teléfono 1
        { wch: 15 }, // Teléfono 2
        { wch: 25 }, // Vinculación económica
        { wch: 20 }, // Nombre de contacto
        { wch: 20 }, // Tipo de cliente
        { wch: 15 }, // Usuario ARCA
        { wch: 15 }, // Contraseña ARCA
        { wch: 15 }, // Usuario AGIP
        { wch: 15 }, // Contraseña AGIP
        { wch: 15 }, // Usuario ARBA
        { wch: 15 }, // Contraseña ARBA
        { wch: 40 }, // Link carpeta Google Drive
      ];
      ws['!cols'] = colWidths;

      utils.book_append_sheet(wb, ws, 'Clientes');

      // Generar el nombre del archivo con fecha
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `clientes_exportacion_${dateStr}.xlsx`;

      // Descargar el archivo
      writeFile(wb, fileName);

      alert(`Exportación completada: ${allSubforums.length} clientes exportados`);
    } catch (error: any) {
      console.error('Error al exportar clientes:', error);
      alert(`Error al exportar clientes: ${error?.message || 'Error desconocido'}`);
    }
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(newMode);
    localStorage.setItem('clientsViewMode', newMode);
  };

  useEffect(() => {
    // Cargar datos en paralelo
    Promise.all([
      loadSubforums(),
      loadPendingTasks(),
      loadFavorites()
    ]);
  }, [profile?.id, tenantId]);

  const loadFavorites = async () => {
    if (!profile?.id || !tenantId) return;

    try {
      const { data, error } = await supabase
        .from('client_favorites')
        .select('subforum_id')
        .eq('user_id', profile.id)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      const favoriteSet = new Set<string>();
      data?.forEach((fav) => {
        favoriteSet.add(fav.subforum_id);
      });
      setFavoriteIds(favoriteSet);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = useCallback(async (subforumId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile?.id || !tenantId) {
      alert('Error: No se pudo identificar el usuario o la empresa');
      return;
    }

    try {
      const isFavorite = favoriteIds.has(subforumId);

      if (isFavorite) {
        // Eliminar favorito
        const { error } = await supabase
          .from('client_favorites')
          .delete()
          .eq('user_id', profile.id)
          .eq('subforum_id', subforumId)
          .eq('tenant_id', tenantId);

        if (error) throw error;

        setFavoriteIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(subforumId);
          return newSet;
        });
      } else {
        // Agregar favorito
        const { error } = await supabase
          .from('client_favorites')
          .insert({
            user_id: profile.id,
            subforum_id: subforumId,
            tenant_id: tenantId,
          } as any);

        if (error) throw error;

        setFavoriteIds((prev) => {
          const newSet = new Set(prev);
          newSet.add(subforumId);
          return newSet;
        });
      }

      // Actualizar el estado de los subforos
      setSubforums((prev) =>
        prev.map((forum) =>
          forum.id === subforumId
            ? { ...forum, is_favorite: !isFavorite }
            : forum
        )
      );
    } catch (error: any) {
      console.error('Error al actualizar el favorito:', error);
      alert(`Error al actualizar el favorito: ${error?.message || 'Error desconocido'}`);
    }
  }, [profile?.id, tenantId, favoriteIds]);

  // Verificar si hay un parámetro subforum en la URL después de cargar los subforos
  useEffect(() => {
    if (loading || subforums.length === 0) return;
    
    const hash = window.location.hash;
    const subforumMatch = hash.match(/[?&]subforum=([^&]+)/);
    if (subforumMatch) {
      const subforumId = subforumMatch[1];
      const subforum = subforums.find(s => s.id === subforumId);
      if (subforum) {
        setSelectedSubforum(subforumId);
        // Limpiar el parámetro de la URL
        window.history.replaceState(null, '', window.location.pathname + '#forums');
      }
    }
  }, [loading, subforums]);

  // Actualizar selectedSubforum cuando cambia initialSubforumId
  useEffect(() => {
    if (initialSubforumId) {
      setSelectedSubforum(initialSubforumId);
    }
  }, [initialSubforumId]);

  // Escuchar evento para abrir subforo desde notificación
  useEffect(() => {
    const handleOpenForum = async (event: CustomEvent) => {
      const { subforumId } = event.detail;
      if (!subforumId) return;

      // Función auxiliar para abrir el subforo
      const openSubforumById = async (subforumIdToOpen: string) => {
        // Si los subforos ya están cargados, buscar el subforo
        if (subforums.length > 0) {
          const subforum = subforums.find(s => s.id === subforumIdToOpen);
          if (subforum) {
            setSelectedSubforum(subforumIdToOpen);
            if (onSubforumChange) {
              onSubforumChange(subforumIdToOpen);
            }
            return;
          }
        }

        // Si no está en la lista, cargarlo directamente desde la base de datos
        try {
          const { data, error } = await supabase
            .from('subforums')
            .select('*')
            .eq('id', subforumIdToOpen)
            .single();

          if (error) throw error;
          if (data) {
            setSelectedSubforum(subforumIdToOpen);
            if (onSubforumChange) {
              onSubforumChange(subforumIdToOpen);
            }
          }
        } catch (error) {
          console.error('Error al cargar el subforo:', error);
        }
      };

      await openSubforumById(subforumId);
    };

    window.addEventListener('openForum', handleOpenForum as EventListener);

    return () => {
      window.removeEventListener('openForum', handleOpenForum as EventListener);
    };
  }, [subforums, onSubforumChange]);

  useEffect(() => {
    // Recargar tareas pendientes y vencimientos cada 30 segundos
    const interval = setInterval(() => {
      loadPendingTasks();
      if (subforums.length > 0) {
        loadPendingVencimientos(subforums);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [subforums.length]);

  // Eliminado - ahora usamos useMemo para filteredSubforums

  const loadSubforums = async () => {
    if (!profile?.id) return;

    try {
      let data;
      let error;

      if (profile.role === 'user') {
        const { data: permData, error: permError } = await supabase
          .from('subforum_permissions')
          .select('subforum_id')
          .eq('user_id', profile.id)
          .eq('can_view', true);

        if (permError) throw permError;

        const subforumIds = permData?.map((p) => p.subforum_id) || [];

        if (subforumIds.length === 0) {
          setSubforums([]);
          setLoading(false);
          return;
        }

        const result = await supabase
          .from('subforums')
          .select('*')
          .in('id', subforumIds);

        data = result.data;
        error = result.error;
      } else {
        const query = supabase
          .from('subforums')
          .select('*');
        
        if (tenantId) {
          query.eq('tenant_id', tenantId);
        }
        
        const result = await query;
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      if (data) {
        const subforumIds = data.map(f => f.id);
        
        // Cargar favoritos y archivos en paralelo
        const [favDataResult, messagesResult] = await Promise.all([
          // Cargar favoritos si no están cargados
          (async () => {
            let currentFavoriteIds = favoriteIds;
            if (currentFavoriteIds.size === 0 && profile?.id && tenantId) {
              const { data: favData } = await supabase
                .from('client_favorites')
                .select('subforum_id')
                .eq('user_id', profile.id)
                .eq('tenant_id', tenantId);

              if (favData) {
                currentFavoriteIds = new Set(favData.map((fav: any) => fav.subforum_id));
                setFavoriteIds(currentFavoriteIds);
              }
            }
            return currentFavoriteIds;
          })(),
          // Cargar todos los mensajes de todos los subforums en una sola consulta
          subforumIds.length > 0 ? supabase
            .from('forum_messages')
            .select('subforum_id, attachments')
            .in('subforum_id', subforumIds) : Promise.resolve({ data: [], error: null })
        ]);

        const currentFavoriteIds = favDataResult;
        const { data: allMessages } = messagesResult;

        // Crear mapa de conteo de archivos por subforum_id
        const fileCountMap = new Map<string, number>();
        if (allMessages) {
          allMessages.forEach((message: any) => {
            const subforumId = message.subforum_id;
            const attachments = message.attachments;
            
            if (attachments && Array.isArray(attachments)) {
              const currentCount = fileCountMap.get(subforumId) || 0;
              fileCountMap.set(subforumId, currentCount + attachments.length);
            }
          });
        }

        // Mapear los datos con los conteos
        const forumsWithCounts = data.map((forum) => ({
          ...forum,
          message_count: fileCountMap.get(forum.id) || 0,
          is_favorite: currentFavoriteIds.has(forum.id),
        }));

        setSubforums(forumsWithCounts);
        
        // Recargar vencimientos después de cargar los subforums (en paralelo, no bloquea)
        loadPendingVencimientos(forumsWithCounts);
      }
    } catch (error) {
      console.error('Error loading subforums:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingTasks = async () => {
    if (!profile) return;

    try {
      // Obtener todas las tareas pendientes o en progreso
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, title, client_name, status, due_date')
        .in('status', ['pending', 'in_progress'])
        .not('client_name', 'is', null);

      if (error) throw error;

      // Agrupar por cliente
      const tasksByClient = new Map<string, number>();
      tasks?.forEach(task => {
        if (task.client_name) {
          const current = tasksByClient.get(task.client_name) || 0;
          tasksByClient.set(task.client_name, current + 1);
        }
      });

      setPendingTasksCount(tasksByClient);
    } catch (error) {
      console.error('Error loading pending tasks:', error);
    }
  };

  const getPendingTasksForClient = useCallback(async (clientName: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('client_name', clientName)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching tasks for client:', error);
      return [];
    }
  }, []);

  const handleShowPendingTasks = useCallback(async (clientName: string) => {
    const tasks = await getPendingTasksForClient(clientName);
    setShowPendingTasksModal({ clientName, tasks });
  }, [getPendingTasksForClient]);

  // Función para obtener el último dígito del CUIT
  const getLastDigitOfCuit = (cuit: string | null | undefined): number | null => {
    if (!cuit) return null;
    // Remover guiones y espacios
    const cleanCuit = cuit.replace(/[-\s]/g, '');
    // Obtener el último carácter
    const lastChar = cleanCuit[cleanCuit.length - 1];
    const lastDigit = parseInt(lastChar, 10);
    return isNaN(lastDigit) ? null : lastDigit;
  };

  // Función para cargar vencimientos pendientes (optimizada)
  const loadPendingVencimientos = async (clientes: Subforum[] = subforums) => {
    if (!tenantId) return;

    try {
      // Obtener todos los clientes con CUIT
      const clientesConCuit = clientes.filter(f => f.cuit);
      if (clientesConCuit.length === 0) {
        setPendingVencimientosCount(new Map());
        return;
      }

      // Obtener todos los tipos de vencimientos únicos que necesitamos
      const tiposVencimientosNecesarios = new Set<string>();
      clientesConCuit.forEach(cliente => {
        if (cliente.vencimientos_tipos && cliente.vencimientos_tipos.length > 0) {
          cliente.vencimientos_tipos.forEach(tipo => tiposVencimientosNecesarios.add(tipo));
        }
      });

      // Construir consulta optimizada
      let query = supabase
        .from('vencimientos')
        .select('hoja_nombre, datos')
        .eq('tenant_id', tenantId);

      // Si todos los clientes tienen tipos específicos, filtrar en la BD
      const todosTienenTipos = clientesConCuit.every(c => c.vencimientos_tipos && c.vencimientos_tipos.length > 0);
      if (todosTienenTipos && tiposVencimientosNecesarios.size > 0) {
        query = query.in('hoja_nombre', Array.from(tiposVencimientosNecesarios));
      }

      const { data: vencimientosData, error } = await query;

      if (error) throw error;

      // Obtener todas las tareas de los clientes para verificar cuáles están completadas
      const clientNames = clientesConCuit.map(c => c.client_name).filter(Boolean);
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, status, client_name')
        .eq('tenant_id', tenantId)
        .in('client_name', clientNames)
        .in('status', ['pending', 'in_progress', 'completed', 'cancelled']);

      // Obtener todos los vencimientos gestionados completados de los clientes
      const { data: vencimientosGestionData } = await supabase
        .from('vencimientos_gestion')
        .select('id, status, vencimiento_tipo, periodo, client_name')
        .eq('tenant_id', tenantId)
        .in('client_name', clientNames)
        .in('status', ['completed']);

      // Crear mapa de vencimientos pendientes por cliente
      const vencimientosMap = new Map<string, number>();

      clientesConCuit.forEach((cliente) => {
        const lastDigit = getLastDigitOfCuit(cliente.cuit);
        if (lastDigit === null) return;

        const cuitColumn = `CUIT ${lastDigit}`;
        let count = 0;

        // Filtrar vencimientos según los tipos seleccionados para el cliente
        let vencimientosFiltrados = vencimientosData || [];
        if (cliente.vencimientos_tipos && cliente.vencimientos_tipos.length > 0) {
          vencimientosFiltrados = vencimientosFiltrados.filter(v => 
            cliente.vencimientos_tipos!.includes(v.hoja_nombre)
          );
        }

        // Obtener tareas del cliente
        const tareasDelCliente = tasksData?.filter(t => t.client_name === cliente.client_name) || [];
        
        // Obtener vencimientos gestionados del cliente
        const vencimientosGestionDelCliente = vencimientosGestionData?.filter(vg => vg.client_name === cliente.client_name) || [];

        // Contar vencimientos en las hojas filtradas (excluyendo los completados)
        vencimientosFiltrados.forEach((vencimiento) => {
          const datos = vencimiento.datos as any;
          if (datos && datos[cuitColumn]) {
            const fechaVencimiento = datos[cuitColumn];
            // Si tiene fecha de vencimiento
            if (fechaVencimiento && fechaVencimiento !== null && fechaVencimiento !== '') {
              const periodo = datos.Periodo || datos.periodo || '-';
              const hojaNombre = vencimiento.hoja_nombre;
              
              // Buscar si hay una tarea relacionada completada
              const tareaCompletada = tareasDelCliente.find((task) => {
                if (!task.title || task.status !== 'completed') return false;
                const tituloLower = task.title.toLowerCase();
                const hojaLower = hojaNombre.toLowerCase();
                const periodoLower = periodo.toLowerCase();
                
                // Verificar si el título contiene el tipo de vencimiento y el período
                return tituloLower.includes(hojaLower) && tituloLower.includes(periodoLower);
              });

              // Buscar si hay un vencimiento gestionado completado
              const vencimientoGestionadoCompletado = vencimientosGestionDelCliente.find((vg) => {
                return vg.vencimiento_tipo === hojaNombre && vg.periodo === periodo && vg.status === 'completed';
              });

              // Solo contar si NO tiene tarea completada Y NO tiene vencimiento gestionado completado
              if (!tareaCompletada && !vencimientoGestionadoCompletado) {
                count++;
              }
            }
          }
        });

        if (count > 0) {
          vencimientosMap.set(cliente.id, count);
        }
      });

      setPendingVencimientosCount(vencimientosMap);
    } catch (error) {
      console.error('Error cargando vencimientos pendientes:', error);
    }
  };

  // Función para obtener vencimientos de un cliente (optimizada)
  const getVencimientosForClient = useCallback(async (clientCuit: string | null | undefined, clientName: string, vencimientosTipos?: string[] | null): Promise<any[]> => {
    if (!tenantId || !clientCuit) return [];

    const lastDigit = getLastDigitOfCuit(clientCuit);
    if (lastDigit === null) return [];

    try {
      // Solo seleccionar los campos necesarios
      let query = supabase
        .from('vencimientos')
        .select('hoja_nombre, datos')
        .eq('tenant_id', tenantId);

      // Si hay tipos de vencimientos seleccionados, filtrar por ellos
      if (vencimientosTipos && vencimientosTipos.length > 0) {
        query = query.in('hoja_nombre', vencimientosTipos);
      }

      const { data: vencimientosData, error } = await query;

      if (error) throw error;

      // Obtener vencimientos gestionados relacionados con este cliente
      const { data: vencimientosGestionData } = await supabase
        .from('vencimientos_gestion')
        .select('id, title, status, vencimiento_tipo, periodo, client_name')
        .eq('tenant_id', tenantId)
        .eq('client_name', clientName);

      const cuitColumn = `CUIT ${lastDigit}`;
      const vencimientos: any[] = [];

      if (vencimientosData) {
        vencimientosData.forEach((vencimiento) => {
          const datos = vencimiento.datos as any;
          if (datos && datos[cuitColumn] && datos[cuitColumn] !== null && datos[cuitColumn] !== '') {
            const periodo = datos.Periodo || datos.periodo || '-';
            const hojaNombre = vencimiento.hoja_nombre;
            
            // Buscar vencimiento gestionado relacionado: debe coincidir el tipo y el período
            const vencimientoGestionado = vencimientosGestionData?.find((vg) => {
              return vg.vencimiento_tipo === hojaNombre && vg.periodo === periodo;
            });

            vencimientos.push({
              hoja_nombre: hojaNombre,
              periodo: periodo,
              fecha_vencimiento: datos[cuitColumn],
              datos_completos: datos,
              vencimiento_gestion: vencimientoGestionado ? {
                id: vencimientoGestionado.id,
                status: vencimientoGestionado.status,
                title: vencimientoGestionado.title
              } : null,
              // Mantener compatibilidad con código antiguo que busca "tarea"
              tarea: vencimientoGestionado ? {
                id: vencimientoGestionado.id,
                status: vencimientoGestionado.status,
                title: vencimientoGestionado.title
              } : null
            });
          }
        });
      }

      return vencimientos;
    } catch (error) {
      console.error('Error obteniendo vencimientos del cliente:', error);
      return [];
    }
  }, [tenantId]);

  const handleShowVencimientos = useCallback(async (clientName: string, clientCuit: string | null | undefined, vencimientosTipos?: string[] | null) => {
    const vencimientos = await getVencimientosForClient(clientCuit, clientName, vencimientosTipos);
    setShowVencimientosModal({ clientName, clientCuit: clientCuit || '', vencimientos });
    setSelectedVencimientosForBulk(new Set()); // Limpiar selección al abrir modal
  }, [getVencimientosForClient]);

  // Suscripción en tiempo real para actualizar el modal de vencimientos cuando cambie el estado
  useEffect(() => {
    if (!showVencimientosModal || !tenantId) return;

    const channel = supabase
      .channel(`vencimientos-gestion-updates-${showVencimientosModal.clientName}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vencimientos_gestion',
          filter: `tenant_id=eq.${tenantId}`,
        },
        async (payload) => {
          // Recargar los vencimientos del modal cuando se actualiza uno
          const vencimientosActualizados = await getVencimientosForClient(
            showVencimientosModal.clientCuit,
            showVencimientosModal.clientName,
            null
          );
          setShowVencimientosModal({
            ...showVencimientosModal,
            vencimientos: vencimientosActualizados
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showVencimientosModal, tenantId, getVencimientosForClient]);

  // Función para recargar los vencimientos del modal
  const reloadVencimientosModal = useCallback(async () => {
    if (!showVencimientosModal) return;
    
    const vencimientosActualizados = await getVencimientosForClient(
      showVencimientosModal.clientCuit,
      showVencimientosModal.clientName,
      null
    );
    setShowVencimientosModal({
      ...showVencimientosModal,
      vencimientos: vencimientosActualizados
    });
  }, [showVencimientosModal, getVencimientosForClient]);

  // Función para parsear fecha de vencimiento
  const parseVencimientoDate = useCallback((fechaStr: string): string => {
    if (!fechaStr) return '';
    
    const meses: { [key: string]: string } = {
      'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };
    
    try {
      const parts = fechaStr.toLowerCase().trim().split('-');
      if (parts.length >= 2) {
        const dia = parts[0].padStart(2, '0');
        const mesAbbr = parts[1].substring(0, 3);
        const mes = meses[mesAbbr] || '01';
        
        let año = new Date().getFullYear().toString();
        if (parts.length >= 3 && parts[2]) {
          año = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        }
        
        const fecha = new Date(`${año}-${mes}-${dia}`);
        if (isNaN(fecha.getTime())) {
          return '';
        }
        
        return `${año}-${mes}-${dia}`;
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
    return '';
  }, []);

  // Función para crear vencimientos de forma masiva
  const handleCreateBulkVencimientos = useCallback(async () => {
    if (!profile || !tenantId || !showVencimientosModal) return;
    if (selectedVencimientosForBulk.size === 0) return;

    setCreatingBulk(true);

    try {
      // Obtener el cliente para buscar el usuario responsable
      let responsableId: string | null = null;
      if (showVencimientosModal.clientName || showVencimientosModal.clientCuit) {
        let query = supabase
          .from('subforums')
          .select('vencimientos_responsable_id')
          .eq('tenant_id', tenantId);
        
        if (showVencimientosModal.clientName) {
          query = query.eq('client_name', showVencimientosModal.clientName);
        } else if (showVencimientosModal.clientCuit) {
          query = query.eq('cuit', showVencimientosModal.clientCuit);
        }
        
        const { data: clienteData } = await query.limit(1).maybeSingle();
        if (clienteData?.vencimientos_responsable_id) {
          responsableId = clienteData.vencimientos_responsable_id;
        }
      }

      // Filtrar vencimientos seleccionados que no tengan vencimiento gestionado
      const vencimientosParaCrear = showVencimientosModal.vencimientos.filter(
        (venc, idx) => selectedVencimientosForBulk.has(`${venc.hoja_nombre}-${venc.periodo}-${idx}`) && !venc.vencimiento_gestion && !venc.tarea
      );

      if (vencimientosParaCrear.length === 0) {
        alert('No hay vencimientos seleccionados válidos para crear');
        setCreatingBulk(false);
        return;
      }

      // Crear todos los vencimientos
      const vencimientosParaInsertar = vencimientosParaCrear.map(venc => {
        const fechaVencimiento = parseVencimientoDate(venc.fecha_vencimiento);
        const fechaVencimientoDate = fechaVencimiento ? new Date(fechaVencimiento).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        
        return {
          title: `Vencimiento ${venc.hoja_nombre} - ${venc.periodo}`,
          description: `Vencimiento de ${venc.hoja_nombre} para el período ${venc.periodo}.\nFecha de vencimiento: ${venc.fecha_vencimiento}\nCliente: ${showVencimientosModal.clientName}`,
          client_name: showVencimientosModal.clientName,
          client_cuit: showVencimientosModal.clientCuit || null,
          vencimiento_tipo: venc.hoja_nombre,
          periodo: venc.periodo,
          fecha_vencimiento: fechaVencimientoDate,
          fecha_vencimiento_original: venc.fecha_vencimiento,
          priority: 'medium' as const,
          status: 'pending' as const,
          created_by: profile.id,
          tenant_id: tenantId
        };
      });

      // Insertar en lotes
      const batchSize = 50;
      const vencimientosCreados: string[] = [];

      for (let i = 0; i < vencimientosParaInsertar.length; i += batchSize) {
        const batch = vencimientosParaInsertar.slice(i, i + batchSize);
        const { data: vencimientosData, error: vencimientosError } = await supabase
          .from('vencimientos_gestion')
          .insert(batch)
          .select('id');

        if (vencimientosError) {
          console.error('Error creando vencimientos en lote:', vencimientosError);
          throw vencimientosError;
        }

        if (vencimientosData) {
          vencimientosCreados.push(...vencimientosData.map(v => v.id));
        }
      }

      // Si hay un usuario responsable, asignarlo automáticamente a todos los vencimientos creados
      if (responsableId && vencimientosCreados.length > 0) {
        const asignaciones = vencimientosCreados.map(vencimientoId => ({
          vencimiento_id: vencimientoId,
          assigned_to_user: responsableId,
          assigned_by: profile.id,
          tenant_id: tenantId
        }));

        // Insertar asignaciones en lotes
        for (let i = 0; i < asignaciones.length; i += batchSize) {
          const batch = asignaciones.slice(i, i + batchSize);
          const { error: assignError } = await supabase
            .from('vencimientos_gestion_assignments')
            .insert(batch);

          if (assignError) {
            console.warn('Error asignando vencimientos al responsable:', assignError);
          }
        }
      }

      // Recargar vencimientos y limpiar selección
      await loadPendingVencimientos(subforums);
      setSelectedVencimientosForBulk(new Set());
      setShowVencimientosModal(null);
      
      alert(`Se crearon ${vencimientosCreados.length} vencimientos exitosamente`);
    } catch (error: any) {
      console.error('Error creando vencimientos masivos:', error);
      
      // Mensaje de error más descriptivo
      let errorMessage = 'Error al crear vencimientos';
      
      if (error.code === 'PGRST205' || error.code === 'PGRST116' || error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('schema cache')) {
        errorMessage = '⚠️ La tabla vencimientos_gestion no existe o no está en el schema cache.\n\n📋 Pasos para solucionarlo:\n\n1. Ve a Supabase Dashboard → SQL Editor\n2. Ejecuta el archivo: 20250127000009_create_vencimientos_gestion_table.sql\n3. Espera 30-60 segundos\n4. Recarga esta página (F5)\n5. Intenta crear los vencimientos nuevamente\n\n💡 Si ya ejecutaste la migración, espera unos minutos para que el schema cache se actualice.';
      } else if (error.message) {
        errorMessage = `Error al crear vencimientos: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setCreatingBulk(false);
    }
  }, [profile, tenantId, showVencimientosModal, selectedVencimientosForBulk, parseVencimientoDate, subforums]);

  // Memoizar el filtrado de subforums para evitar recálculos innecesarios
  const filteredSubforums = useMemo(() => {
    let filtered = [...subforums];

    // Filtro por favoritos
    if (filterByFavorites) {
      filtered = filtered.filter((forum) => favoriteIds.has(forum.id));
    }

    // Filtro por búsqueda de texto
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (forum) =>
          forum.name.toLowerCase().includes(searchLower) ||
          forum.client_name.toLowerCase().includes(searchLower) ||
          forum.description?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro por tareas pendientes
    if (filterByTasks === 'with_tasks') {
      filtered = filtered.filter(
        (forum) => (pendingTasksCount.get(forum.client_name) || 0) > 0
      );
    } else if (filterByTasks === 'without_tasks') {
      filtered = filtered.filter(
        (forum) => (pendingTasksCount.get(forum.client_name) || 0) === 0
      );
    }

    // Ordenamiento: Favoritos primero, luego el orden seleccionado
    filtered.sort((a, b) => {
      const aIsFavorite = favoriteIds.has(a.id);
      const bIsFavorite = favoriteIds.has(b.id);

      // Si uno es favorito y el otro no, el favorito va primero
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;

      // Si ambos son favoritos o ninguno, aplicar el orden seleccionado
      if (sortBy === 'alphabetical') {
        const comparison = a.client_name.localeCompare(b.client_name, 'es', { sensitivity: 'base' });
        return sortOrder === 'asc' ? comparison : -comparison;
      } else if (sortBy === 'activity') {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }

      return 0;
    });

    return filtered;
  }, [subforums, searchTerm, sortBy, sortOrder, filterByTasks, filterByFavorites, favoriteIds, pendingTasksCount]);

  if (selectedSubforum) {
    return (
      <SubforumChat
        subforumId={selectedSubforum}
        onBack={() => {
          setSelectedSubforum(null);
          if (onSubforumChange) {
            onSubforumChange(null);
          }
          loadSubforums();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="pt-8 sm:pt-10 md:pt-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
            <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
            <span className="truncate">Gestión de Clientes</span>
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1 sm:mt-2">
            Base de datos completa de clientes con archivos, documentos y comunicación centralizada
          </p>
        </div>
        {canCreateForum && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                setBulkAssignModalKey(prev => prev + 1);
                setShowBulkAssignModal(true);
              }}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm sm:text-base"
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="truncate">Asignación Masiva</span>
            </button>
            <button
              onClick={exportClientsToExcel}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-sm sm:text-base"
              title="Exportar todos los clientes a Excel"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="truncate">Exportar Clientes</span>
            </button>
            <button
              onClick={() => setShowBulkImportModal(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm sm:text-base"
            >
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="truncate">Importar Clientes</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Nuevo Cliente</span>
            </button>
          </div>
        )}
      </div>

      {/* Banner informativo sobre funcionalidades */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 border border-blue-200 dark:border-slate-600 rounded-xl p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-blue-900 dark:text-white mb-2 sm:mb-3 flex items-center gap-2">
          <File className="w-4 h-4 sm:w-5 sm:h-5" />
          Sistema Completo de Gestión
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="bg-white dark:bg-slate-700 rounded-lg p-1.5 sm:p-2 flex-shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-blue-900 dark:text-blue-200 text-xs sm:text-sm">Documentos</p>
              <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300">PDFs, Excel, Word y más</p>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="bg-white dark:bg-slate-700 rounded-lg p-1.5 sm:p-2 flex-shrink-0">
              <Image className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-blue-900 dark:text-blue-200 text-xs sm:text-sm">Multimedia</p>
              <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300">Fotos, videos e imágenes</p>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3 sm:col-span-2 md:col-span-1">
            <div className="bg-white dark:bg-slate-700 rounded-lg p-1.5 sm:p-2 flex-shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-blue-900 dark:text-blue-200 text-xs sm:text-sm">Comunicación</p>
              <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-300">Chat y mensajería en tiempo real</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 mb-4 sm:mb-6 p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Buscar clientes por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Panel de Filtros */}
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3 pt-3 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="font-medium">Filtros:</span>
          </div>

          {/* Filtro por Orden Alfabético */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial min-w-0">
            <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">Orden:</label>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 sm:flex-initial">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as 'alphabetical' | 'activity' | 'none');
                  if (e.target.value === 'none') {
                    setSortOrder('asc');
                  }
                }}
                className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1 sm:flex-initial min-w-0"
              >
                <option value="none">Sin orden</option>
                <option value="alphabetical">Alfabético</option>
                <option value="activity">Actividad</option>
              </select>
              {sortBy !== 'none' && (
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors flex-shrink-0"
                  title={sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
                >
                  {sortOrder === 'asc' ? (
                    <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-300" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-300" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Filtro por Tareas Pendientes */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-initial min-w-0">
            <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">Tareas:</label>
            <select
              value={filterByTasks}
              onChange={(e) => setFilterByTasks(e.target.value as 'all' | 'with_tasks' | 'without_tasks')}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1 sm:flex-initial min-w-0"
            >
              <option value="all">Todos</option>
              <option value="with_tasks">Con tareas pendientes</option>
              <option value="without_tasks">Sin tareas pendientes</option>
            </select>
          </div>

          {/* Filtro por Favoritos */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setFilterByFavorites(!filterByFavorites)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm border rounded-lg transition-colors ${
                filterByFavorites
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700/50 text-yellow-700 dark:text-yellow-300'
                  : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
              }`}
            >
              <Star className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${filterByFavorites ? 'fill-yellow-500 text-yellow-500' : ''}`} />
              <span>Favoritos</span>
            </button>
            <button
              onClick={toggleViewMode}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm border rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700/50 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
              }`}
              title={viewMode === 'grid' ? 'Cambiar a vista de lista' : 'Cambiar a vista de tarjetas'}
            >
              {viewMode === 'grid' ? (
                <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <Grid3x3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
              <span className="hidden sm:inline">{viewMode === 'grid' ? 'Lista' : 'Tarjetas'}</span>
            </button>
          </div>

          {/* Botón para limpiar filtros */}
          {(sortBy !== 'none' || filterByTasks !== 'all' || filterByFavorites || searchTerm) && (
            <button
              onClick={() => {
                setSortBy('none');
                setSortOrder('asc');
                setFilterByTasks('all');
                setFilterByFavorites(false);
                setSearchTerm('');
              }}
              className="w-full sm:w-auto sm:ml-auto px-3 py-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {filteredSubforums.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 sm:p-8 md:p-12 text-center">
          <FolderOpen className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-1.5 sm:mb-2">
            {searchTerm ? 'No se encontraron clientes' : 'No hay clientes disponibles'}
          </h3>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            {canCreateForum && !searchTerm
              ? 'Crea el primer cliente para comenzar a gestionar archivos y comunicación'
              : 'No tienes acceso a ningún cliente todavía'}
          </p>
        </div>
      ) : (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {filteredSubforums.map((forum) => (
              <div
                key={forum.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-5 md:p-6 hover:shadow-md transition relative group cursor-pointer"
                onClick={() => setSelectedSubforum(forum.id)}
              >
              <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 flex gap-0.5 sm:gap-1 flex-wrap">
                {/* Botón de Favorito */}
                <button
                  onClick={(e) => toggleFavorite(forum.id, e)}
                  className={`p-1.5 sm:p-2 rounded-lg transition ${
                    favoriteIds.has(forum.id)
                      ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                      : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                  }`}
                  title={favoriteIds.has(forum.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                >
                  <Star className={`w-4 h-4 sm:w-5 sm:h-5 ${favoriteIds.has(forum.id) ? 'fill-current' : ''}`} />
                </button>
                {canCreateForum && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditClientFor(forum);
                      }}
                      className="p-1.5 sm:p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title="Editar datos del cliente"
                    >
                      <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setManageDeptPermissionsFor({ forumId: forum.forum_id, forumName: forum.name });
                      }}
                      className="p-1.5 sm:p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                      title="Permisos por departamento"
                    >
                      <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setManagePermissionsFor(forum);
                      }}
                      className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Permisos por usuario"
                    >
                      <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFilesFor(forum);
                    }}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center hover:from-blue-200 hover:to-indigo-200 transition-colors cursor-pointer"
                    title="Ver archivos del cliente"
                  >
                    <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowClientInfoFor(forum);
                    }}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center hover:from-blue-200 hover:to-indigo-200 transition-colors cursor-pointer"
                    title="Ver ficha del cliente"
                  >
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </button>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFilesFor(forum);
                  }}
                  className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition"
                  title="Ver archivos"
                >
                  <File className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{forum.message_count || 0}</span>
                </button>
              </div>

              <div className="w-full text-left pr-8 sm:pr-12 md:pr-16">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-1.5 sm:mb-2 line-clamp-2">{forum.name}</h3>

                {forum.description && (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-2 sm:mb-3 line-clamp-2">
                    {forum.description}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 pt-2 sm:pt-3 border-t border-gray-100 dark:border-slate-700 mb-1.5 sm:mb-2">
                  <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 truncate max-w-full">
                    Cliente: {forum.client_name}
                  </span>
                </div>
                {/* Badge de Vencimientos Pendientes */}
                {pendingVencimientosCount.get(forum.id) && pendingVencimientosCount.get(forum.id)! > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShowVencimientos(forum.client_name, forum.cuit, forum.vencimientos_tipos);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg text-orange-700 dark:text-orange-300 text-xs sm:text-sm font-medium transition-colors duration-150 mt-2"
                  >
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="truncate">{pendingVencimientosCount.get(forum.id)} vencimiento{pendingVencimientosCount.get(forum.id)! > 1 ? 's' : ''} pendiente{pendingVencimientosCount.get(forum.id)! > 1 ? 's' : ''}</span>
                  </button>
                )}
                {/* Badge de Tareas Pendientes */}
                {pendingTasksCount.get(forum.client_name) && pendingTasksCount.get(forum.client_name)! > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShowPendingTasks(forum.client_name);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium transition-colors duration-150 mt-2"
                  >
                    <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="truncate">{pendingTasksCount.get(forum.client_name)} tarea{pendingTasksCount.get(forum.client_name)! > 1 ? 's' : ''} pendiente{pendingTasksCount.get(forum.client_name)! > 1 ? 's' : ''}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Espacio de Trabajo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vencimiento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Archivos</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tareas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {filteredSubforums.map((forum) => (
                    <tr
                      key={forum.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors duration-150 cursor-pointer"
                      onClick={() => setSelectedSubforum(forum.id)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <div className="flex items-center gap-1.5 flex-shrink-0 mr-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowFilesFor(forum);
                              }}
                              className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:from-blue-200 hover:to-indigo-200 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30"
                              title="Ver archivos del cliente"
                            >
                              <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowClientInfoFor(forum);
                              }}
                              className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:from-blue-200 hover:to-indigo-200 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30"
                              title="Ver ficha del cliente"
                            >
                              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </button>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{forum.name}</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(forum.id, e);
                                }}
                                className={`flex-shrink-0 p-1 rounded transition ${
                                  favoriteIds.has(forum.id)
                                    ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                    : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                                }`}
                                title={favoriteIds.has(forum.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                              >
                                <Star className={`w-4 h-4 ${favoriteIds.has(forum.id) ? 'fill-current' : ''}`} />
                              </button>
                            </div>
                            {forum.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                                {forum.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{forum.client_name}</div>
                        {forum.cuit && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">CUIT: {forum.cuit}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {pendingVencimientosCount.get(forum.id) && pendingVencimientosCount.get(forum.id)! > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowVencimientos(forum.client_name, forum.cuit, forum.vencimientos_tipos);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg text-orange-700 dark:text-orange-300 text-xs font-medium transition-colors"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{pendingVencimientosCount.get(forum.id)} pendiente{pendingVencimientosCount.get(forum.id)! > 1 ? 's' : ''}</span>
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-white">
                          <File className="w-4 h-4" />
                          <span>{forum.message_count || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {pendingTasksCount.get(forum.client_name) && pendingTasksCount.get(forum.client_name)! > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowPendingTasks(forum.client_name);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs font-medium transition-colors"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>{pendingTasksCount.get(forum.client_name)} pendiente{pendingTasksCount.get(forum.client_name)! > 1 ? 's' : ''}</span>
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(forum.id, e);
                            }}
                            className={`p-2 rounded-lg transition ${
                              favoriteIds.has(forum.id)
                                ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                            }`}
                            title={favoriteIds.has(forum.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                          >
                            <Star className={`w-4 h-4 ${favoriteIds.has(forum.id) ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowFilesFor(forum);
                            }}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                            title="Ver archivos"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowClientInfoFor(forum);
                            }}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                            title="Ver ficha del cliente"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {canCreateForum && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditClientFor(forum);
                                }}
                                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                                title="Editar cliente"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setManagePermissionsFor(forum);
                                }}
                                className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                                title="Permisos"
                              >
                                <Users className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {showCreateModal && (
        <CreateForumModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadSubforums();
          }}
        />
      )}

      {editClientFor && (
        <EditClientModal
          subforum={editClientFor}
          onClose={() => setEditClientFor(null)}
          onSuccess={() => {
            setEditClientFor(null);
            loadSubforums();
          }}
        />
      )}

      {showClientInfoFor && (
        <ClientInfoModal
          subforum={showClientInfoFor}
          onClose={() => setShowClientInfoFor(null)}
        />
      )}

      {managePermissionsFor && (
        <ManagePermissionsModal
          subforumId={managePermissionsFor.id}
          subforumName={managePermissionsFor.name}
          onClose={() => setManagePermissionsFor(null)}
        />
      )}

      {showFilesFor && (
        <ClientFilesModal
          subforumId={showFilesFor.id}
          subforumName={showFilesFor.name}
          onClose={() => setShowFilesFor(null)}
        />
      )}

      {manageDeptPermissionsFor && (
        <ManageDepartmentPermissionsModal
          forumId={manageDeptPermissionsFor.forumId}
          forumName={manageDeptPermissionsFor.forumName}
          onClose={() => setManageDeptPermissionsFor(null)}
        />
      )}

      {/* Modal de Tareas Pendientes */}
      {showPendingTasksModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto forums-scroll">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Tareas Pendientes - {showPendingTasksModal.clientName}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {showPendingTasksModal.tasks.length} tarea{showPendingTasksModal.tasks.length !== 1 ? 's' : ''} pendiente{showPendingTasksModal.tasks.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowPendingTasksModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {showPendingTasksModal.tasks.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay tareas pendientes para este cliente</p>
              ) : (
                showPendingTasksModal.tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:bg-gray-50 dark:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{task.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            task.status === 'pending' 
                              ? 'bg-gray-100 text-gray-700 dark:text-gray-300'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {task.status === 'pending' ? 'Pendiente' : 'En Progreso'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(task.due_date).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vencimientos Pendientes */}
      {showVencimientosModal && (() => {
        const canCreateTask = profile?.role === 'admin' || profile?.role === 'support';
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto forums-scroll">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Vencimientos - {showVencimientosModal.clientName}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {showVencimientosModal.vencimientos.length} vencimiento{showVencimientosModal.vencimientos.length !== 1 ? 's' : ''} pendiente{showVencimientosModal.vencimientos.length !== 1 ? 's' : ''}
                  </p>
                  {showVencimientosModal.clientCuit && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      CUIT: {showVencimientosModal.clientCuit} (Último dígito: {getLastDigitOfCuit(showVencimientosModal.clientCuit)})
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {canCreateTask && selectedVencimientosForBulk.size > 0 && (
                    <button
                      onClick={handleCreateBulkVencimientos}
                      disabled={creatingBulk}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingBulk ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creando...</span>
                        </>
                      ) : (
                        <>
                          <Layers className="w-4 h-4" />
                          <span>Crear Masiva ({selectedVencimientosForBulk.size})</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowVencimientosModal(null);
                      setSelectedVencimientosForBulk(new Set());
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            <div className="p-6">
              {showVencimientosModal.vencimientos.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay vencimientos pendientes para este cliente</p>
              ) : (
                <div className="space-y-4">
                  {/* Agrupar por hoja */}
                  {(() => {
                    const groupedByHoja = new Map<string, any[]>();
                    showVencimientosModal.vencimientos.forEach((venc) => {
                      const hoja = venc.hoja_nombre;
                      if (!groupedByHoja.has(hoja)) {
                        groupedByHoja.set(hoja, []);
                      }
                      groupedByHoja.get(hoja)!.push(venc);
                    });

                    return Array.from(groupedByHoja.entries()).map(([hojaNombre, vencimientos]) => (
                      <div key={hojaNombre} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-lg">
                          {hojaNombre}
                        </h3>
                        <div className="space-y-2">
                          {vencimientos.map((venc, idx) => {
                            const getStatusBadge = (status: string | null | undefined) => {
                              if (!status) return null;
                              
                              const statusConfig = {
                                'pending': {
                                  label: 'Pendiente',
                                  className: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
                                  icon: Clock
                                },
                                'in_progress': {
                                  label: 'En Progreso',
                                  className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
                                  icon: Loader2
                                },
                                'completed': {
                                  label: 'Completada',
                                  className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
                                  icon: CheckCircle2
                                },
                                'cancelled': {
                                  label: 'Cancelada',
                                  className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
                                  icon: X
                                }
                              };
                              
                              const config = statusConfig[status as keyof typeof statusConfig];
                              if (!config) return null;
                              
                              const Icon = config.icon;
                              
                              return (
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.className}`}>
                                  <Icon className={`w-3 h-3 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
                                  {config.label}
                                </span>
                              );
                            };

                            // Verificar si el usuario puede crear tareas (solo admin y support)
                            const canCreateTask = profile?.role === 'admin' || profile?.role === 'support';
                            const vencimientoKey = `${venc.hoja_nombre}-${venc.periodo}-${idx}`;
                            const isSelected = selectedVencimientosForBulk.has(vencimientoKey);
                            // Usar vencimiento_gestion si existe, sino usar tarea (compatibilidad)
                            const vencimientoRelacionado = venc.vencimiento_gestion || venc.tarea;

                            return (
                              <div
                                key={idx}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-150 ${
                                  vencimientoRelacionado
                                    ? vencimientoRelacionado.status === 'completed'
                                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                                      : vencimientoRelacionado.status === 'in_progress'
                                      ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                                      : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600'
                                    : canCreateTask
                                      ? isSelected
                                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                                        : 'bg-gray-50 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-gray-200 dark:border-slate-600 hover:border-blue-200 dark:hover:border-blue-800'
                                      : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600'
                                }`}
                              >
                                {canCreateTask && !vencimientoRelacionado && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const newSelection = new Set(selectedVencimientosForBulk);
                                      if (e.target.checked) {
                                        newSelection.add(vencimientoKey);
                                      } else {
                                        newSelection.delete(vencimientoKey);
                                      }
                                      setSelectedVencimientosForBulk(newSelection);
                                    }}
                                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer flex-shrink-0"
                                  />
                                )}
                                <button
                                  onClick={() => {
                                    if (!vencimientoRelacionado && canCreateTask) {
                                      setShowCreateVencimientoFromVencimiento({
                                        clientName: showVencimientosModal.clientName,
                                        clientCuit: showVencimientosModal.clientCuit || '',
                                        vencimiento: venc
                                      });
                                      setShowVencimientosModal(null);
                                    }
                                  }}
                                  className={`flex-1 flex items-center justify-between text-left group ${
                                    vencimientoRelacionado || !canCreateTask ? 'cursor-default' : 'cursor-pointer'
                                  }`}
                                  disabled={!!vencimientoRelacionado || !canCreateTask}
                                >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Calendar className={`w-4 h-4 transition-colors ${
                                      vencimientoRelacionado
                                        ? vencimientoRelacionado.status === 'completed'
                                          ? 'text-green-600 dark:text-green-400'
                                          : vencimientoRelacionado.status === 'in_progress'
                                          ? 'text-blue-600 dark:text-blue-400'
                                          : 'text-gray-600 dark:text-gray-400'
                                        : 'text-orange-600 dark:text-orange-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                    }`} />
                                    <span className={`font-medium transition-colors ${
                                      vencimientoRelacionado
                                        ? vencimientoRelacionado.status === 'completed'
                                          ? 'text-green-700 dark:text-green-300'
                                          : vencimientoRelacionado.status === 'in_progress'
                                          ? 'text-blue-700 dark:text-blue-300'
                                          : 'text-gray-900 dark:text-white'
                                        : 'text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300'
                                    }`}>
                                      {venc.periodo}
                                    </span>
                                    {vencimientoRelacionado && getStatusBadge(vencimientoRelacionado.status)}
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Vencimiento: <span className={`font-semibold transition-colors ${
                                      vencimientoRelacionado
                                        ? vencimientoRelacionado.status === 'completed'
                                          ? 'text-green-700 dark:text-green-300'
                                          : vencimientoRelacionado.status === 'in_progress'
                                          ? 'text-blue-700 dark:text-blue-300'
                                          : 'text-orange-700 dark:text-orange-300'
                                        : 'text-orange-700 dark:text-orange-300 group-hover:text-blue-700 dark:group-hover:text-blue-400'
                                    }`}>{venc.fecha_vencimiento}</span>
                                  </p>
                                  {vencimientoRelacionado && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {venc.vencimiento_gestion ? 'Vencimiento: ' : 'Tarea: '}{vencimientoRelacionado.title}
                                    </p>
                                  )}
                                </div>
                                  {!vencimientoRelacionado && canCreateTask && (
                                    <div className="ml-3 text-xs text-orange-600 dark:text-orange-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                      <Calendar className="w-3.5 h-3.5" />
                                      Crear vencimiento
                                    </div>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modal de Asignación Masiva */}
      {showBulkAssignModal && (
        <BulkAssignUsersModal
          key={bulkAssignModalKey}
          subforums={subforums}
          onClose={() => {
            setShowBulkAssignModal(false);
            setBulkAssignModalKey(prev => prev + 1);
          }}
          onSuccess={() => {
            setShowBulkAssignModal(false);
            setBulkAssignModalKey(prev => prev + 1);
            loadSubforums();
          }}
        />
      )}
      
      {/* Modal de Importación Masiva */}
      {showBulkImportModal && (
        <BulkImportClientsModal
          onClose={() => setShowBulkImportModal(false)}
          onSuccess={() => {
            setShowBulkImportModal(false);
            loadSubforums();
          }}
        />
      )}

      {/* Modal de Crear Vencimiento desde Vencimiento */}
      {showCreateVencimientoFromVencimiento && (() => {
        const { clientName, clientCuit, vencimiento } = showCreateVencimientoFromVencimiento;
        
        // Convertir fecha de vencimiento (formato: "18-feb" o "18-feb-2026") a formato de fecha para el input
        const parseVencimientoDate = (fechaStr: string): string => {
          if (!fechaStr) return '';
          
          // Mapeo de meses en español a números
          const meses: { [key: string]: string } = {
            'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
            'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
          };
          
          try {
            // Formato esperado: "18-feb" o "18-feb-2026"
            const parts = fechaStr.toLowerCase().trim().split('-');
            if (parts.length >= 2) {
              const dia = parts[0].padStart(2, '0');
              const mesAbbr = parts[1].substring(0, 3);
              const mes = meses[mesAbbr] || '01';
              
              let año = new Date().getFullYear().toString();
              if (parts.length >= 3 && parts[2]) {
                año = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              }
              
              const fecha = new Date(`${año}-${mes}-${dia}`);
              if (isNaN(fecha.getTime())) {
                return '';
              }
              
              return `${año}-${mes}-${dia}`;
            }
          } catch (e) {
            console.error('Error parsing date:', e);
          }
          return '';
        };

        const fechaVencimiento = parseVencimientoDate(vencimiento.fecha_vencimiento);
        const tituloVencimiento = `Vencimiento ${vencimiento.hoja_nombre} - ${vencimiento.periodo}`;
        const descripcionVencimiento = `Vencimiento de ${vencimiento.hoja_nombre} para el período ${vencimiento.periodo}.\nFecha de vencimiento: ${vencimiento.fecha_vencimiento}\nCliente: ${clientName}`;

        return (
          <CreateVencimientoModal
            onClose={() => {
              setShowCreateVencimientoFromVencimiento(null);
              loadPendingVencimientos(subforums);
            }}
            onSuccess={async () => {
              setShowCreateVencimientoFromVencimiento(null);
              await loadPendingVencimientos(subforums);
              
              // Si el modal de vencimientos está abierto, recargarlo para mostrar el estado actualizado
              if (showVencimientosModal) {
                const vencimientosActualizados = await getVencimientosForClient(
                  showVencimientosModal.clientCuit,
                  showVencimientosModal.clientName,
                  null
                );
                setShowVencimientosModal({
                  ...showVencimientosModal,
                  vencimientos: vencimientosActualizados
                });
              }
            }}
            initialClientName={clientName}
            initialClientCuit={clientCuit}
            initialVencimientoTipo={vencimiento.hoja_nombre}
            initialPeriodo={vencimiento.periodo}
            initialFechaVencimiento={fechaVencimiento}
            initialFechaVencimientoOriginal={vencimiento.fecha_vencimiento}
            initialTitle={tituloVencimiento}
            initialDescription={descripcionVencimiento}
          />
        );
      })()}
    </div>
  );
}
