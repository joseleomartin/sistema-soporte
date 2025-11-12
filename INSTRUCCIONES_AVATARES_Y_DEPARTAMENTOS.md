# 📸 Sistema de Avatares y Departamentos

## ✨ Nuevas Funcionalidades Implementadas

### 1. **Fotos de Perfil (Avatares)**
Los usuarios ahora pueden subir su propia foto de perfil que se mostrará en:
- Sidebar (menú lateral)
- Perfil personal
- Próximamente: comentarios, tickets, etc.

### 2. **Sistema de Departamentos/Grupos**
Sistema completo para organizar usuarios en departamentos:
- **Contadores**
- **Abogados**
- **Soporte**
- **Administración**
- Y los que tú crees...

---

## 🚀 Pasos para Activar las Funcionalidades

### **Paso 1: Ejecutar Script SQL en Supabase**

1. Ve a tu proyecto en [Supabase](https://supabase.com)
2. Abre el **SQL Editor** en el menú lateral
3. Ejecuta el siguiente script:

```sql
-- Agregar columna de avatar a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Crear tabla de departamentos
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de asignación de usuarios a departamentos
CREATE TABLE IF NOT EXISTS user_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- Habilitar RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;

-- Políticas para departments
CREATE POLICY "Everyone can view departments"
  ON departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can create departments"
  ON departments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Only admins can update departments"
  ON departments FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Only admins can delete departments"
  ON departments FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Políticas para user_departments
CREATE POLICY "Everyone can view user departments"
  ON user_departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can assign departments"
  ON user_departments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Only admins can remove department assignments"
  ON user_departments FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_department_id ON user_departments(department_id);

-- Departamentos de ejemplo
INSERT INTO departments (name, description, color) VALUES
  ('Contadores', 'Departamento de contabilidad y finanzas', '#10B981'),
  ('Abogados', 'Departamento legal', '#3B82F6'),
  ('Soporte', 'Equipo de soporte técnico', '#F59E0B'),
  ('Administración', 'Administración general', '#8B5CF6')
ON CONFLICT (name) DO NOTHING;
```

4. Haz clic en **"Run"**
5. Deberías ver: `Success. No rows returned`

### **Paso 2: Crear Bucket de Storage para Avatares**

1. En Supabase, ve a **Storage** en el menú lateral
2. Haz clic en **"Create a new bucket"**
3. Configura:
   - **Name**: `avatars`
   - **Public bucket**: ✅ **Activado** (muy importante)
   - **File size limit**: 2 MB
   - **Allowed MIME types**: `image/*`
4. Haz clic en **"Create bucket"**

### **Paso 3: Configurar Políticas de Storage**

1. En Storage, selecciona el bucket `avatars`
2. Ve a la pestaña **"Policies"**
3. Haz clic en **"New Policy"** y selecciona **"For full customization"**
4. Crea las siguientes políticas:

**Política 1: Ver avatares (SELECT)**
```sql
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

**Política 2: Subir avatar (INSERT)**
```sql
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**Política 3: Actualizar avatar (UPDATE)**
```sql
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**Política 4: Eliminar avatar (DELETE)**
```sql
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## 📱 Cómo Usar las Nuevas Funcionalidades

### **Para Usuarios:**

#### **Subir Foto de Perfil**
1. Haz clic en **"Mi Perfil"** en el menú lateral (icono de engranaje)
2. Verás tu avatar actual (o un icono por defecto)
3. Haz clic en el **icono de cámara** sobre el avatar
4. Selecciona una imagen (máximo 2MB)
5. ¡Listo! Tu foto se actualizará automáticamente

#### **Ver tus Departamentos**
1. En **"Mi Perfil"** verás los departamentos a los que perteneces
2. Cada departamento tiene un color distintivo

### **Para Administradores:**

#### **Gestionar Departamentos**
1. Haz clic en **"Departamentos"** en el menú lateral
2. Verás todos los departamentos existentes
3. Puedes:
   - ✅ **Crear** nuevos departamentos
   - ✏️ **Editar** nombre, descripción y color
   - 🗑️ **Eliminar** departamentos
   - 👥 **Asignar** usuarios a departamentos

#### **Asignar Usuarios a Departamentos**
1. En la tarjeta de cada departamento, haz clic en **"Asignar"**
2. Se abrirá un modal con todos los usuarios
3. Marca/desmarca los usuarios que quieres asignar
4. Los cambios se guardan automáticamente

#### **Crear Nuevo Departamento**
1. Haz clic en **"Nuevo Departamento"**
2. Completa:
   - **Nombre**: Ej. "Marketing"
   - **Descripción**: Breve descripción del departamento
   - **Color**: Selecciona un color distintivo
3. Haz clic en **"Crear"**

---

## 🎨 Características del Sistema

### **Avatares:**
- ✅ Subida de imágenes (JPG, PNG, GIF, WEBP)
- ✅ Límite de 2MB por imagen
- ✅ Vista previa instantánea
- ✅ Almacenamiento seguro en Supabase Storage
- ✅ URLs públicas para acceso rápido
- ✅ Actualización automática en toda la aplicación

### **Departamentos:**
- ✅ Nombre y descripción personalizables
- ✅ 8 colores predefinidos para identificación visual
- ✅ Asignación múltiple (un usuario puede estar en varios departamentos)
- ✅ Contador de usuarios por departamento
- ✅ Solo administradores pueden gestionar
- ✅ Todos los usuarios pueden ver departamentos

### **Seguridad:**
- 🔒 RLS (Row Level Security) activado
- 🔒 Solo usuarios autenticados pueden ver información
- 🔒 Solo administradores pueden crear/editar/eliminar
- 🔒 Cada usuario solo puede subir su propio avatar
- 🔒 Validación de tamaño y tipo de archivo

---

## 🔍 Verificación

### **Comprobar que todo funciona:**

1. **Avatares:**
   - Ve a "Mi Perfil"
   - Sube una foto
   - Verifica que aparezca en el sidebar
   - Refresca la página y verifica que persista

2. **Departamentos:**
   - Ve a "Departamentos"
   - Crea un nuevo departamento
   - Asigna usuarios
   - Verifica que los usuarios vean sus departamentos en "Mi Perfil"

---

## ❓ Solución de Problemas

### **Error al subir avatar:**
- Verifica que el bucket `avatars` esté público
- Verifica que las políticas de storage estén creadas
- Verifica que la imagen sea menor a 2MB

### **No puedo crear departamentos:**
- Verifica que tu usuario tenga rol `admin`
- Verifica que las políticas RLS estén creadas

### **No veo mis departamentos:**
- Verifica que un administrador te haya asignado a un departamento
- Refresca la página

---

## 📊 Estructura de Base de Datos

### **Tabla: profiles**
```
- id (uuid)
- email (text)
- full_name (text)
- role (text)
- avatar_url (text) ← NUEVO
- created_at (timestamptz)
- updated_at (timestamptz)
```

### **Tabla: departments**
```
- id (uuid)
- name (text)
- description (text)
- color (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### **Tabla: user_departments**
```
- id (uuid)
- user_id (uuid) → profiles.id
- department_id (uuid) → departments.id
- assigned_by (uuid) → profiles.id
- assigned_at (timestamptz)
```

---

## 🎯 Próximos Pasos Sugeridos

1. Mostrar avatares en:
   - Comentarios de tickets
   - Mensajes de foros
   - Lista de usuarios
   - Salas de reunión

2. Filtrar por departamento:
   - En gestión de usuarios
   - En asignación de tickets
   - En reportes

3. Notificaciones por departamento:
   - Enviar mensajes a todos los miembros de un departamento
   - Crear tickets asignados a un departamento

---

¿Necesitas ayuda con algún paso? ¡Pregúntame! 🚀

