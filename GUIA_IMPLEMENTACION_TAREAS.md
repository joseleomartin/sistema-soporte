# 🎯 Guía de Implementación: Sistema de Gestión de Tareas

## ✅ Implementación Completada

He implementado el sistema completo de gestión de tareas según las especificaciones. Aquí está todo lo que se ha creado:

---

## 📁 Archivos Creados

### Base de Datos
- **`supabase/migrations/20251112170000_create_tasks_system.sql`**
  - Tablas: `tasks`, `task_assignments`, `task_messages`, `task_attachments`
  - Políticas RLS completas
  - Índices para performance
  - Triggers para updated_at
  - Configuración de Realtime

### Componentes Frontend
1. **`src/components/Tasks/TasksList.tsx`**
   - Vista de tarjetas tipo ticket
   - Filtros por estado, prioridad, fecha
   - Búsqueda por título o cliente
   - Colores por prioridad (Rojo/Azul/Verde)

2. **`src/components/Tasks/CreateTaskModal.tsx`**
   - Formulario completo de creación
   - Validaciones
   - Asignación a usuarios o departamentos
   - Selector de prioridad visual

3. **`src/components/Tasks/TaskDetail.tsx`**
   - Vista detallada de la tarea
   - Selector de estado (dropdown)
   - Información del cliente y fechas
   - Integración con TaskChat

4. **`src/components/Tasks/TaskChat.tsx`**
   - Chat en tiempo real con Supabase Realtime
   - Subida y descarga de archivos
   - Mensajes con avatares
   - Scroll automático

### Integración
- **`src/App.tsx`** - Ruta agregada para 'tasks'
- **`src/components/Layout/Sidebar.tsx`** - Icono CheckSquare agregado al menú

---

## 🚀 Pasos para Activar el Sistema

### 1. Aplicar la Migración SQL

```bash
# En Supabase Dashboard
1. Ve a SQL Editor
2. Copia el contenido de: project/supabase/migrations/20251112170000_create_tasks_system.sql
3. Ejecuta la migración
```

O si usas CLI:

```bash
supabase db push
```

### 2. Crear Bucket de Storage

```bash
# En Supabase Dashboard
1. Ve a Storage
2. Click en "Create bucket"
3. Nombre: task-attachments
4. Público: NO (private)
5. Click en "Create"

# Configurar políticas RLS del bucket
6. Ve a las políticas del bucket
7. Agrega política de SELECT:
   - authenticated users can view task attachments if assigned

8. Agrega política de INSERT:
   - authenticated users can upload task attachments if assigned
```

### 3. Verificar Dependencias

Todas las dependencias ya están instaladas:
- React 18 ✅
- TypeScript ✅
- TailwindCSS ✅
- Supabase Client ✅
- Lucide React (iconos) ✅

### 4. Compilar y Probar

```bash
cd project
npm run dev
```

---

## 🎨 Características Implementadas

### Diseño Visual
- ✅ Colores por prioridad (Rojo #EF4444, Azul #3B82F6, Verde #10B981)
- ✅ Tarjetas con sombra y hover effect
- ✅ Borde izquierdo de 4px según prioridad
- ✅ Badges visuales para estado y prioridad
- ✅ Indicadores de fecha vencida

### Funcionalidades
- ✅ Crear tareas (solo admin)
- ✅ Asignar a usuarios individuales
- ✅ Asignar a departamentos
- ✅ Ver lista de tareas con filtros
- ✅ Ver detalle de tarea
- ✅ Cambiar estado de tarea (usuarios asignados)
- ✅ Chat en tiempo real
- ✅ Subir archivos al chat
- ✅ Descargar archivos del chat
- ✅ Validaciones de formularios

### Permisos RLS
- ✅ Administradores: CRUD completo
- ✅ Usuarios asignados: ver y actualizar estado
- ✅ Usuarios de departamentos: ver y actualizar tareas del departamento
- ✅ Solo usuarios asignados pueden ver/enviar mensajes
- ✅ Solo usuarios asignados pueden subir/descargar archivos

---

## 📊 Estructura de Datos

### Tabla: tasks
```sql
- id (uuid)
- title (text)
- description (text)
- client_name (text)
- due_date (timestamptz)
- priority ('low' | 'medium' | 'urgent')
- status ('pending' | 'in_progress' | 'completed' | 'cancelled')
- created_by (uuid → profiles)
- created_at, updated_at
```

### Tabla: task_assignments
```sql
- id (uuid)
- task_id (uuid → tasks)
- assigned_to_user (uuid → profiles, nullable)
- assigned_to_department (uuid → departments, nullable)
- assigned_by (uuid → profiles)
- assigned_at
- Constraint: debe tener usuario O departamento, no ambos
```

### Tabla: task_messages
```sql
- id (uuid)
- task_id (uuid → tasks)
- user_id (uuid → profiles)
- message (text)
- created_at
```

### Tabla: task_attachments
```sql
- id (uuid)
- task_id (uuid → tasks)
- message_id (uuid → task_messages, nullable)
- file_name, file_path, file_size, file_type
- uploaded_by (uuid → profiles)
- uploaded_at
```

---

## 🔧 Configuración del Storage Bucket

### Políticas RLS para task-attachments

```sql
-- Política de SELECT
CREATE POLICY "Usuarios asignados pueden ver archivos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    auth.uid() IN (
      SELECT assigned_to_user FROM task_assignments
      WHERE task_id = (storage.foldername(name))[1]::uuid
    )
    OR
    (SELECT department_id FROM profiles WHERE id = auth.uid()) IN (
      SELECT assigned_to_department FROM task_assignments
      WHERE task_id = (storage.foldername(name))[1]::uuid
    )
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);

-- Política de INSERT
CREATE POLICY "Usuarios asignados pueden subir archivos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (
    auth.uid() IN (
      SELECT assigned_to_user FROM task_assignments
      WHERE task_id = (storage.foldername(name))[1]::uuid
    )
    OR
    (SELECT department_id FROM profiles WHERE id = auth.uid()) IN (
      SELECT assigned_to_department FROM task_assignments
      WHERE task_id = (storage.foldername(name))[1]::uuid
    )
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);
```

---

## 🧪 Cómo Probar el Sistema

### 1. Como Administrador

```
1. Login como admin
2. Ve a "Tareas" en el sidebar
3. Click en "Nueva Tarea"
4. Completa el formulario:
   - Título: "Revisar documentación cliente X"
   - Descripción: "Revisar y actualizar toda la documentación"
   - Cliente: "Cliente X"
   - Fecha límite: (fecha futura)
   - Prioridad: Urgente (rojo)
   - Asignar a: Usuario individual o Departamento
5. Click en "Crear Tarea"
6. Verifica que aparece en la lista
7. Click en la tarea para ver el detalle
8. Envía un mensaje en el chat
9. Adjunta un archivo
```

### 2. Como Usuario Asignado

```
1. Login como el usuario asignado
2. Ve a "Tareas" en el sidebar
3. Deberías ver solo tus tareas asignadas
4. Click en una tarea
5. Cambia el estado a "En Progreso"
6. Envía mensajes en el chat
7. Adjunta archivos
8. Descarga archivos adjuntos
```

### 3. Filtros y Búsqueda

```
1. En la lista de tareas:
   - Busca por título: escribe parte del título
   - Busca por cliente: escribe el nombre del cliente
   - Filtra por estado: selecciona del dropdown
   - Filtra por prioridad: selecciona del dropdown
   - Combina filtros (búsqueda + estado + prioridad)
```

---

## 🎨 Colores y Diseño

### Prioridad: Urgente
```css
background: #FEE2E2
border: #EF4444
text: #991B1B
```

### Prioridad: Media
```css
background: #DBEAFE
border: #3B82F6
text: #1E40AF
```

### Prioridad: Baja
```css
background: #D1FAE5
border: #10B981
text: #065F46
```

### Estados
- Pendiente: `#6B7280` (gris)
- En Progreso: `#3B82F6` (azul)
- Completada: `#10B981` (verde)
- Cancelada: `#EF4444` (rojo)

---

## 🐛 Troubleshooting

### Error: "relation tasks does not exist"
**Solución**: Aplica la migración SQL en Supabase.

### Error: "bucket task-attachments not found"
**Solución**: Crea el bucket en Supabase Storage.

### Error: "Row level security policy violation"
**Solución**: Verifica que las políticas RLS estén aplicadas correctamente.

### Los mensajes no aparecen en tiempo real
**Solución**: 
1. Verifica que Realtime esté habilitado en Supabase
2. Verifica que `task_messages` esté en la publicación de Realtime
3. Ejecuta: `ALTER PUBLICATION supabase_realtime ADD TABLE task_messages;`

### No puedo descargar archivos
**Solución**: Verifica las políticas RLS del bucket `task-attachments`.

---

## 📝 Checklist de Implementación

- [x] Migración SQL creada
- [x] Componente TasksList creado
- [x] Componente CreateTaskModal creado
- [x] Componente TaskDetail creado
- [x] Componente TaskChat creado
- [x] Ruta agregada en App.tsx
- [x] Icono agregado en Sidebar.tsx
- [ ] Migración SQL aplicada en Supabase
- [ ] Bucket task-attachments creado
- [ ] Políticas RLS del bucket configuradas
- [ ] Sistema probado como admin
- [ ] Sistema probado como usuario
- [ ] Chat en tiempo real verificado
- [ ] Subida de archivos probada
- [ ] Descarga de archivos probada

---

## 🚀 Próximos Pasos

1. **Aplicar la migración SQL** en Supabase Dashboard
2. **Crear el bucket** `task-attachments` y configurar políticas
3. **Reiniciar el servidor** de desarrollo: `npm run dev`
4. **Probar el sistema** siguiendo los pasos de prueba
5. **Ajustar estilos** si es necesario

---

## 🎉 Sistema Listo para Usar

El sistema está completamente implementado y listo para usarse. Solo falta aplicar la migración SQL y crear el bucket de storage en Supabase.

**Recuerda**: Los administradores pueden crear y asignar tareas. Los usuarios solo ven y gestionan sus tareas asignadas.

¿Necesitas ayuda con algún paso específico? 🚀



