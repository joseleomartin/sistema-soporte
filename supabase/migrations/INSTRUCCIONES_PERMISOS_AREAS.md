# 🔐 Sistema de Permisos por Área

## ✨ Funcionalidad Implementada

Sistema completo de permisos basado en áreas (departments) que permite configurar:
- **Qué módulos pueden ver** los usuarios según su área
- **Qué acciones pueden realizar**: crear, editar, eliminar

## 🚀 Pasos para Activar

### **Paso 1: Ejecutar Migración SQL en Supabase**

1. Ve a tu proyecto en [Supabase](https://supabase.com)
2. Abre el **SQL Editor** en el menú lateral
3. Ejecuta el script `20250120000034_create_department_permissions.sql`

O copia y pega el siguiente contenido:

```sql
-- Ver el archivo: project/supabase/migrations/20250120000034_create_department_permissions.sql
```

### **Paso 2: Configurar Permisos por Área**

1. Ve a **Personas > Áreas** en la aplicación
2. Haz clic en el botón de **editar** (lápiz) de cualquier área
3. Haz clic en la pestaña **"Permisos"**
4. Configura los permisos para cada módulo:
   - **Ver**: Permite ver el módulo en el sidebar
   - **Crear**: Permite crear nuevos registros
   - **Editar**: Permite editar registros existentes
   - **Eliminar**: Permite eliminar registros

### **Paso 3: Asignar Usuarios a Áreas**

1. En la misma pantalla de **Áreas**, haz clic en **"Asignar"** en cualquier área
2. Selecciona los usuarios que pertenecen a esa área
3. Los permisos se aplicarán automáticamente según la configuración del área

## 📋 Comportamiento del Sistema

### **Jerarquía de Permisos:**
1. **Administradores**: Siempre tienen acceso completo a todo (no se ven afectados por permisos de área)
2. **Usuarios con áreas asignadas**: Se aplican los permisos configurados para sus áreas
3. **Usuarios sin áreas asignadas**: Tienen acceso completo por defecto (comportamiento legacy)

### **Permisos Combinados:**
Si un usuario pertenece a múltiples áreas, se aplican los permisos más permisivos (OR lógico):
- Si el área A permite "ver" y el área B no, el usuario puede ver
- Si el área A permite "crear" o el área B permite "crear", el usuario puede crear

## 🎯 Módulos Configurables

Los siguientes módulos pueden ser configurados:
- Inicio
- Sala de Reuniones
- Áreas
- Onboarding y Políticas Internas
- Bibliotecas y Cursos
- Novedades Profesionales
- Vacaciones y Licencias
- Social
- Producción
- Empleados
- Stock
- Ventas
- Compras
- Costos
- Proveedores
- Clientes
- Carga de Horas
- Tareas
- Herramientas
- Soporte
- Usuarios
- Mi Perfil

## 🔧 Uso en Código

Para verificar permisos en componentes:

```typescript
import { useDepartmentPermissions } from '../../hooks/useDepartmentPermissions';

function MyComponent() {
  const { canView, canCreate, canEdit, canDelete, getPermissions } = useDepartmentPermissions();

  // Verificar si puede ver un módulo
  if (!canView('fabinsa-production')) {
    return <div>No tienes acceso a este módulo</div>;
  }

  // Verificar permisos de acciones
  const perms = getPermissions('fabinsa-production');
  
  return (
    <div>
      {perms.canCreate && <button>Crear</button>}
      {perms.canEdit && <button>Editar</button>}
      {perms.canDelete && <button>Eliminar</button>}
    </div>
  );
}
```

## ⚠️ Notas Importantes

- Los permisos se aplican automáticamente en el **Sidebar** para ocultar módulos no permitidos
- Los administradores siempre tienen acceso completo, independientemente de los permisos de área
- Si un usuario no tiene áreas asignadas, mantiene acceso completo (comportamiento por defecto)
- Los permisos se actualizan en tiempo real cuando se modifican en la configuración del área







