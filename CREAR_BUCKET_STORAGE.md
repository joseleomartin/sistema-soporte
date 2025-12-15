# 🪣 Crear Bucket de Storage para Tareas

## 🐛 Error: Bucket not found

```
StorageApiError: Bucket not found
```

Este error ocurre porque el bucket `task-attachments` no existe en Supabase Storage.

---

## ✅ Solución: Crear el Bucket

### **Paso 1: Crear el Bucket en Supabase Dashboard**

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. En el menú lateral, ve a **Storage**
3. Click en **"Create a new bucket"** o **"New Bucket"**
4. Configura el bucket:

```
Name: task-attachments
Public: NO (desactivado) ← Importante para seguridad
File size limit: 50 MB (opcional)
Allowed MIME types: (dejar vacío para permitir todos)
```

5. Click en **"Create bucket"**

---

### **Paso 2: Configurar Políticas RLS del Bucket**

Después de crear el bucket, necesitas configurar las políticas de seguridad.

#### **Opción A: Desde el Dashboard (Recomendado)**

1. En **Storage**, click en el bucket **task-attachments**
2. Ve a la pestaña **"Policies"**
3. Click en **"New Policy"**

---

#### **Política 1: Ver archivos (SELECT)**

```sql
CREATE POLICY "Usuarios asignados pueden ver archivos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    -- Extraer task_id del path: task-attachments/TASK_ID/filename.ext
    (storage.foldername(name))[1]::uuid IN (
      -- Tareas asignadas directamente al usuario
      SELECT task_id FROM task_assignments
      WHERE assigned_to_user = auth.uid()
      UNION
      -- Tareas asignadas a departamentos del usuario
      SELECT ta.task_id FROM task_assignments ta
      JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
      WHERE ud.user_id = auth.uid()
    )
    OR
    -- Admins pueden ver todo
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);
```

**En el Dashboard:**
- Policy name: `Usuarios asignados pueden ver archivos`
- Policy command: `SELECT`
- Target roles: `authenticated`
- USING expression: (copia el contenido del `USING` de arriba)

---

#### **Política 2: Subir archivos (INSERT)**

```sql
CREATE POLICY "Usuarios asignados pueden subir archivos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (
    -- El path debe ser: task-attachments/TASK_ID/...
    (storage.foldername(name))[1]::uuid IN (
      -- Tareas asignadas directamente al usuario
      SELECT task_id FROM task_assignments
      WHERE assigned_to_user = auth.uid()
      UNION
      -- Tareas asignadas a departamentos del usuario
      SELECT ta.task_id FROM task_assignments ta
      JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
      WHERE ud.user_id = auth.uid()
    )
    OR
    -- Admins pueden subir a cualquier tarea
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);
```

**En el Dashboard:**
- Policy name: `Usuarios asignados pueden subir archivos`
- Policy command: `INSERT`
- Target roles: `authenticated`
- WITH CHECK expression: (copia el contenido del `WITH CHECK` de arriba)

---

#### **Política 3: Eliminar archivos (DELETE) - Opcional**

```sql
CREATE POLICY "Usuarios pueden eliminar sus propios archivos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    -- Extraer task_id del path
    (storage.foldername(name))[1]::uuid IN (
      SELECT task_id FROM task_assignments
      WHERE assigned_to_user = auth.uid()
      UNION
      SELECT ta.task_id FROM task_assignments ta
      JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
      WHERE ud.user_id = auth.uid()
    )
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);
```

---

#### **Opción B: Desde SQL Editor (Más Rápido)**

1. Ve a **SQL Editor** en Supabase Dashboard
2. Crea un nuevo query
3. Copia y ejecuta el siguiente script completo:

```sql
-- ============================================
-- CREAR BUCKET Y POLÍTICAS RLS
-- ============================================

-- Asegurarse de que el bucket existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-attachments', 'task-attachments', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Política 1: Ver archivos
DROP POLICY IF EXISTS "Usuarios asignados pueden ver archivos" ON storage.objects;
CREATE POLICY "Usuarios asignados pueden ver archivos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT task_id FROM task_assignments
      WHERE assigned_to_user = auth.uid()
      UNION
      SELECT ta.task_id FROM task_assignments ta
      JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
      WHERE ud.user_id = auth.uid()
    )
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);

-- Política 2: Subir archivos
DROP POLICY IF EXISTS "Usuarios asignados pueden subir archivos" ON storage.objects;
CREATE POLICY "Usuarios asignados pueden subir archivos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT task_id FROM task_assignments
      WHERE assigned_to_user = auth.uid()
      UNION
      SELECT ta.task_id FROM task_assignments ta
      JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
      WHERE ud.user_id = auth.uid()
    )
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);

-- Política 3: Eliminar archivos (opcional)
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios archivos" ON storage.objects;
CREATE POLICY "Usuarios pueden eliminar sus propios archivos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT task_id FROM task_assignments
      WHERE assigned_to_user = auth.uid()
      UNION
      SELECT ta.task_id FROM task_assignments ta
      JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
      WHERE ud.user_id = auth.uid()
    )
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);
```

4. Click en **"Run"**
5. ✅ **Listo!** El bucket y las políticas están configuradas

---

## 🔍 Verificar que el Bucket Existe

### **En el Dashboard:**
1. Ve a **Storage**
2. Deberías ver el bucket **task-attachments** en la lista

### **En SQL Editor:**
```sql
SELECT * FROM storage.buckets WHERE id = 'task-attachments';
```

**Resultado esperado:**
```
id                | name              | public | file_size_limit
------------------|-------------------|--------|----------------
task-attachments  | task-attachments  | false  | 52428800
```

---

## 🔍 Verificar las Políticas

```sql
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%task%';
```

**Resultado esperado:**
```
storage | objects | Usuarios asignados pueden ver archivos     | SELECT
storage | objects | Usuarios asignados pueden subir archivos   | INSERT
storage | objects | Usuarios pueden eliminar sus propios...    | DELETE
```

---

## 🧪 Probar la Subida de Archivos

1. Recarga la aplicación (Ctrl + R)
2. Ve a una tarea
3. Abre el chat
4. Click en el icono de adjuntar (📎)
5. Selecciona un archivo (PDF, imagen, etc.)
6. Envía el mensaje
7. ✅ **El archivo debería subirse correctamente**

---

## 🐛 Troubleshooting

### **Error: "Bucket not found"**
**Causa:** El bucket no existe.
**Solución:** Crea el bucket siguiendo el Paso 1.

---

### **Error: "new row violates row-level security policy"**
**Causa:** Las políticas RLS están bloqueando la subida.
**Solución:** 
1. Verifica que el usuario está asignado a la tarea
2. Verifica que las políticas RLS están creadas (Paso 2)
3. Verifica que el path del archivo es correcto: `task-attachments/TASK_ID/filename.ext`

---

### **Error: "Permission denied for relation objects"**
**Causa:** Falta habilitar RLS en la tabla `storage.objects`.
**Solución:**
```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

---

## 📊 Estructura de Archivos

Los archivos se guardan con esta estructura:

```
task-attachments/
├── <task-id-1>/
│   ├── 1731234567890-abc123.pdf
│   ├── 1731234567891-xyz789.png
│   └── 1731234567892-doc456.docx
├── <task-id-2>/
│   ├── 1731234567893-file1.pdf
│   └── 1731234567894-file2.jpg
└── <task-id-3>/
    └── 1731234567895-report.xlsx
```

**Formato del nombre:**
```
<timestamp>-<random-id>.<extension>
```

Ejemplo:
```
1731234567890-abc123.pdf
```

---

## 🔒 Seguridad

Las políticas RLS garantizan que:

- ✅ Los usuarios solo pueden ver archivos de sus tareas asignadas
- ✅ Los usuarios solo pueden subir archivos a sus tareas asignadas
- ✅ Los administradores tienen acceso completo
- ✅ Los archivos están organizados por tarea
- ✅ El bucket NO es público (los archivos no son accesibles sin autenticación)

---

## ✅ Checklist

Después de configurar:

- [ ] Bucket `task-attachments` creado
- [ ] Bucket configurado como privado (public = false)
- [ ] Política de SELECT creada
- [ ] Política de INSERT creada
- [ ] Política de DELETE creada (opcional)
- [ ] RLS habilitado en `storage.objects`
- [ ] Probado subir un archivo
- [ ] Probado descargar un archivo
- [ ] No hay errores en la consola

---

## 🎉 ¡Listo!

Ahora puedes adjuntar archivos en el chat de tareas sin errores. 🚀

**¿Necesitas ayuda con algo más?** Revisa `FIX_CHAT_REALTIME.md` para el error de suscripción de canal.


















