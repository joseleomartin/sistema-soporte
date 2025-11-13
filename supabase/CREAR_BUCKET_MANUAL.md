# 🪣 Crear Bucket Manualmente (Si el Script SQL Falla)

Si el script SQL da error de permisos (`must be owner of table objects`), puedes crear el bucket y las políticas manualmente desde el Dashboard.

---

## 📋 Método 1: Dashboard (Recomendado si SQL falla)

### **Paso 1: Crear el Bucket**

1. Ve a **Storage** en Supabase Dashboard
2. Click en **"New bucket"** o **"Create a new bucket"**
3. Configura:
   ```
   Name: task-attachments
   Public: NO (desactivado) ← Importante
   File size limit: 50 MB (opcional)
   Allowed MIME types: (dejar vacío)
   ```
4. Click en **"Create bucket"**

---

### **Paso 2: Crear Políticas desde el Dashboard**

1. En **Storage**, click en el bucket **task-attachments**
2. Ve a la pestaña **"Policies"**
3. Click en **"New Policy"**

---

#### **Política 1: Ver Archivos (SELECT)**

**Configuración:**
- Policy name: `Usuarios asignados pueden ver archivos`
- Policy command: `SELECT`
- Target roles: `authenticated`
- USING expression:

```sql
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
```

---

#### **Política 2: Subir Archivos (INSERT)**

**Configuración:**
- Policy name: `Usuarios asignados pueden subir archivos`
- Policy command: `INSERT`
- Target roles: `authenticated`
- WITH CHECK expression:

```sql
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
```

---

#### **Política 3: Eliminar Archivos (DELETE) - Opcional**

**Configuración:**
- Policy name: `Usuarios pueden eliminar sus propios archivos`
- Policy command: `DELETE`
- Target roles: `authenticated`
- USING expression:

```sql
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
```

---

## 📋 Método 2: SQL con Función (Actualizado)

El script `CREAR_BUCKET_TASK_ATTACHMENTS.sql` ahora usa una función con `SECURITY DEFINER` que debería funcionar mejor.

**Ejecuta el script actualizado** y debería funcionar.

---

## 🔍 Verificar que Funcionó

### **1. Verificar Bucket:**

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

### **2. Verificar Políticas:**

```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%asignados%';
```

**Resultado esperado:**
```
policyname                                    | cmd
----------------------------------------------|--------
Usuarios asignados pueden ver archivos        | SELECT
Usuarios asignados pueden subir archivos      | INSERT
Usuarios pueden eliminar sus propios archivos | DELETE
```

---

## ✅ Checklist

- [ ] Bucket `task-attachments` creado
- [ ] Bucket configurado como privado (public = false)
- [ ] Política de SELECT creada
- [ ] Política de INSERT creada
- [ ] Política de DELETE creada (opcional)
- [ ] Probado subir un archivo
- [ ] Probado descargar un archivo
- [ ] No hay errores en la consola

---

## 🎉 ¡Listo!

Una vez creado el bucket y las políticas, podrás adjuntar archivos en el chat sin errores. 🚀


