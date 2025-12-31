# 📋 Instrucciones: Migración del Sistema de Proveedores

## ⚠️ IMPORTANTE: Ejecutar la Migración

El módulo de Proveedores requiere ejecutar la migración SQL en Supabase.

---

## 🚀 Cómo Aplicar la Migración

### **Paso 1: Acceder a Supabase Dashboard**

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Abre el **SQL Editor** en el menú lateral

### **Paso 2: Ejecutar la Migración**

1. Abre el archivo: `project/supabase/migrations/20250120000026_create_suppliers_system.sql`
2. **Copia TODO el contenido** del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run** o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)
5. Espera a que termine la ejecución (puede tardar 30-60 segundos)

✅ **Resultado esperado:** Deberías ver "Success. No rows returned" o un mensaje similar

---

## 🔍 Verificar que Funcionó

Después de ejecutar la migración, verifica que las tablas se crearon correctamente:

### 1. **Verificar Tabla de Proveedores**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'suppliers';
```

**Resultado esperado:** Debe mostrar `suppliers`

### 2. **Verificar Todas las Tablas del Sistema**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'suppliers',
  'supplier_documents',
  'supplier_drive_mapping'
)
ORDER BY table_name;
```

**Resultado esperado:** Debe mostrar las 3 tablas listadas

### 3. **Verificar Bucket de Storage**

```sql
SELECT name, public, file_size_limit
FROM storage.buckets
WHERE name = 'supplier-documents';
```

**Resultado esperado:** Debe mostrar el bucket `supplier-documents`

### 4. **Verificar Políticas RLS**

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('suppliers', 'supplier_documents', 'supplier_drive_mapping')
ORDER BY tablename, policyname;
```

**Resultado esperado:** Debe mostrar políticas RLS para cada tabla

### 5. **Verificar Función RPC**

```sql
SELECT proname 
FROM pg_proc 
WHERE proname = 'save_supplier_drive_mapping';
```

**Resultado esperado:** Debe mostrar `save_supplier_drive_mapping`

---

## ⚠️ Si Ocurre un Error

### Error: "relation already exists"
- **Significa:** La tabla ya existe (migración parcial ejecutada)
- **Solución:** El script usa `CREATE TABLE IF NOT EXISTS`, así que es seguro ejecutarlo de nuevo

### Error: "permission denied"
- **Significa:** No tienes permisos suficientes
- **Solución:** Asegúrate de estar usando una cuenta con permisos de administrador en Supabase

### Error: "function get_user_tenant_id() does not exist"
- **Significa:** La función helper no existe
- **Solución:** Ejecuta primero la migración `20250120000000_create_tenants_table.sql` que crea esta función

### Error: "bucket already exists"
- **Significa:** El bucket de storage ya existe
- **Solución:** Es normal, el script usa `ON CONFLICT DO NOTHING`, así que no afecta

---

## 📝 Notas Importantes

1. **La migración es idempotente:** Puedes ejecutarla múltiples veces sin problemas (usa `IF NOT EXISTS`)

2. **No afecta datos existentes:** Solo crea nuevas tablas y políticas

3. **Tiempo estimado:** 30-60 segundos dependiendo de tu conexión

4. **Después de ejecutar:** Recarga la aplicación web para que los cambios surtan efecto

---

## ✅ Después de Ejecutar

Una vez ejecutada la migración:

1. **Recarga la aplicación** en el navegador (F5)
2. **Ve al menú "Negocio"** en el sidebar
3. **Haz clic en "Proveedores"**
4. Deberías poder crear proveedores y subir documentos

---

## 🎯 Funcionalidades del Módulo

El módulo de Proveedores incluye:

- ✅ **CRUD completo de proveedores** con campos:
  - Nombre (requerido)
  - Razón Social
  - CUIT
  - Teléfono de Contacto
  - Email
  - Provincia
  - Dirección
  - Observaciones

- ✅ **Gestión de documentos:**
  - Subir múltiples archivos
  - Ver lista de documentos
  - Descargar documentos
  - Eliminar documentos

- ✅ **Integración con Google Drive:**
  - Vincular carpeta de Google Drive al proveedor
  - Ver documentos desde Drive
  - Solo admins y support pueden configurar Drive

- ✅ **Multi-tenancy:**
  - Todos los datos están aislados por tenant
  - Políticas RLS configuradas

---

Si aún hay problemas, verifica en la consola del navegador (F12) el error específico.


