import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { Database } from '../lib/database.types';

type DepartmentPermission = Database['public']['Tables']['department_permissions']['Row'];

interface PermissionCheck {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
}

/**
 * Hook para verificar permisos del usuario basados en sus áreas
 */
export function useDepartmentPermissions() {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const [permissions, setPermissions] = useState<Record<string, DepartmentPermission>>({});
  const [loading, setLoading] = useState(true);
  const [userDepartments, setUserDepartments] = useState<string[]>([]);

  useEffect(() => {
    if (profile?.id && tenantId) {
      loadUserPermissions();
    } else {
      setLoading(false);
    }
  }, [profile?.id, tenantId]);

  const loadUserPermissions = async () => {
    try {
      // Obtener áreas del usuario
      const { data: userDepts, error: deptError } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', profile!.id)
        .eq('tenant_id', tenantId!);

      if (deptError) throw deptError;

      const departmentIds = (userDepts || []).map(d => d.department_id);
      setUserDepartments(departmentIds);

      if (departmentIds.length === 0) {
        setLoading(false);
        return;
      }

      // Obtener todos los permisos de las áreas del usuario
      const { data: perms, error: permError } = await supabase
        .from('department_permissions')
        .select('*')
        .in('department_id', departmentIds)
        .eq('tenant_id', tenantId!);

      if (permError) throw permError;

      // Agrupar permisos por module_view
      // Si un usuario tiene múltiples áreas, se toman los permisos más permisivos (OR lógico)
      const permissionsMap: Record<string, DepartmentPermission> = {};
      (perms || []).forEach(perm => {
        const existing = permissionsMap[perm.module_view];
        if (!existing) {
          permissionsMap[perm.module_view] = perm;
        } else {
          // Combinar permisos: si alguna área permite, entonces permite
          permissionsMap[perm.module_view] = {
            ...existing,
            can_view: existing.can_view || perm.can_view,
            can_create: existing.can_create || perm.can_create,
            can_edit: existing.can_edit || perm.can_edit,
            can_delete: existing.can_delete || perm.can_delete,
            can_print: existing.can_print || perm.can_print,
          };
        }
      });

      setPermissions(permissionsMap);
    } catch (error) {
      console.error('Error loading department permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verifica si el usuario puede ver un módulo
   */
  const canView = (moduleView: string): boolean => {
    // Mientras se cargan los permisos, no mostrar nada
    if (loading) return false;

    // Si es admin, siempre puede ver todo
    if (profile?.role === 'admin') return true;

    // Si no tiene áreas asignadas, puede ver todo (comportamiento por defecto)
    if (userDepartments.length === 0) return true;

    const perm = permissions[moduleView];
    return perm ? perm.can_view : false;
  };

  /**
   * Verifica si el usuario puede crear en un módulo
   */
  const canCreate = (moduleView: string): boolean => {
    // Mientras se cargan los permisos, no mostrar nada
    if (loading) return false;

    if (profile?.role === 'admin') return true;
    
    // Si no tiene áreas asignadas, permitir todo (comportamiento por defecto)
    if (userDepartments.length === 0) return true;

    // Si tiene áreas asignadas pero no hay permisos configurados para ningún módulo,
    // permitir todo (para evitar bloqueos si no se han configurado permisos aún)
    if (Object.keys(permissions).length === 0) return true;

    const perm = permissions[moduleView];
    // Si no hay permiso configurado para este módulo específico, permitir por defecto
    // Solo si hay un permiso explícitamente configurado, usar ese valor
    return perm ? perm.can_create : true;
  };

  /**
   * Verifica si el usuario puede editar en un módulo
   */
  const canEdit = (moduleView: string): boolean => {
    // Mientras se cargan los permisos, no mostrar nada
    if (loading) return false;

    if (profile?.role === 'admin') return true;
    
    // Si no tiene áreas asignadas, permitir todo (comportamiento por defecto)
    if (userDepartments.length === 0) return true;

    // Si tiene áreas asignadas pero no hay permisos configurados para ningún módulo,
    // permitir todo (para evitar bloqueos si no se han configurado permisos aún)
    if (Object.keys(permissions).length === 0) return true;

    const perm = permissions[moduleView];
    // Si no hay permiso configurado para este módulo específico, permitir por defecto
    // Solo si hay un permiso explícitamente configurado, usar ese valor
    return perm ? perm.can_edit : true;
  };

  /**
   * Verifica si el usuario puede eliminar en un módulo
   */
  const canDelete = (moduleView: string): boolean => {
    // Mientras se cargan los permisos, no mostrar nada
    if (loading) return false;

    if (profile?.role === 'admin') return true;
    
    // Si no tiene áreas asignadas, permitir todo (comportamiento por defecto)
    if (userDepartments.length === 0) return true;

    // Si tiene áreas asignadas pero no hay permisos configurados para ningún módulo,
    // permitir todo (para evitar bloqueos si no se han configurado permisos aún)
    if (Object.keys(permissions).length === 0) return true;

    const perm = permissions[moduleView];
    // Si no hay permiso configurado para este módulo específico, permitir por defecto
    // Solo si hay un permiso explícitamente configurado, usar ese valor
    return perm ? perm.can_delete : true;
  };

  /**
   * Verifica si el usuario puede imprimir/generar PDFs en un módulo
   */
  const canPrint = (moduleView: string): boolean => {
    // Mientras se cargan los permisos, no mostrar nada
    if (loading) return false;

    if (profile?.role === 'admin') return true;
    
    // Si no tiene áreas asignadas, permitir todo (comportamiento por defecto)
    if (userDepartments.length === 0) return true;

    // Si tiene áreas asignadas pero no hay permisos configurados para ningún módulo,
    // permitir todo (para evitar bloqueos si no se han configurado permisos aún)
    if (Object.keys(permissions).length === 0) return true;

    const perm = permissions[moduleView];
    // Si no hay permiso configurado para este módulo específico, permitir por defecto
    // Solo si hay un permiso explícitamente configurado, usar ese valor
    return perm ? perm.can_print : true;
  };

  /**
   * Obtiene todos los permisos de un módulo
   */
  const getPermissions = (moduleView: string): PermissionCheck => {
    return {
      canView: canView(moduleView),
      canCreate: canCreate(moduleView),
      canEdit: canEdit(moduleView),
      canDelete: canDelete(moduleView),
      canPrint: canPrint(moduleView),
    };
  };

  return {
    loading,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canPrint,
    getPermissions,
    userDepartments,
  };
}

