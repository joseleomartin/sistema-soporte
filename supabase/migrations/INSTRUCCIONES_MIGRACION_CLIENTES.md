# 📋 Instrucciones: Migración del Sistema de Clientes (Empresas de Producción)

## ⚠️ IMPORTANTE: Ejecutar la Migración

El módulo de Clientes para empresas de producción requiere ejecutar la migración SQL en Supabase.

---

## 🚀 Cómo Aplicar la Migración

### **Paso 1: Acceder a Supabase Dashboard**

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Abre el **SQL Editor** en el menú lateral

### **Paso 2: Ejecutar la Migración**

1. Abre el archivo: `project/supabase/migrations/20250120000032_create_clients_system.sql`
2. **Copia TODO el contenido** del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run** o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)
5. Espera a que termine la ejecución (puede tardar 30-60 segundos)

✅ **Resultado esperado:** Deberías ver "Success. No rows returned" o un mensaje similar

---

## 🔍 Verificar que Funcionó

Después de ejecutar la migración, verifica que las tablas se crearon correctamente:

### 1. **Verificar Tabla de Clientes**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'clients';
```

**Resultado esperado:** Debe mostrar `clients`

### 2. **Verificar Todas las Tablas del Sistema**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'clients',
  'client_documents',
  'client_drive_mapping'
)
ORDER BY table_name;
```

**Resultado esperado:** Debe mostrar las 3 tablas listadas

### 3. **Verificar Bucket de Storage**

```sql
SELECT name, public, file_size_limit
FROM storage.buckets
WHERE name = 'client-documents';
```

**Resultado esperado:** Debe mostrar el bucket `client-documents`

### 4. **Verificar Políticas RLS**

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('clients', 'client_documents', 'client_drive_mapping')
ORDER BY tablename, policyname;
```

**Resultado esperado:** Debe mostrar múltiples políticas para cada tabla

---

## 📝 Notas Importantes

- Este módulo es **específico para empresas de producción**
- Cuando una empresa tiene `loadout_type = 'produccion'`, el módulo "Clientes" mostrará este nuevo sistema en lugar del módulo tradicional de Forums/Clientes
- El módulo es similar al de Proveedores, pero adaptado para gestión de clientes
- Los documentos se almacenan en el bucket `client-documents` de Supabase Storage
- Se puede vincular una carpeta de Google Drive por cliente
- **IMPORTANTE**: Esta migración modifica la tabla `client_drive_mapping` existente para soportar tanto `subforum_id` (Forums) como `client_id` (Clientes), manteniendo la compatibilidad con el sistema de Forums existente

---

## ✅ Listo

Una vez completada la migración, el módulo de Clientes estará disponible para empresas de producción.

