# 📋 Instrucciones: Migración del Sistema de Vencimientos

## ⚠️ IMPORTANTE: Ejecutar la Migración

El error "Could not find the table 'public.vencimientos_gestion' in the schema cache" indica que la migración del sistema de vencimientos **no se ha ejecutado** en Supabase.

---

## 🚀 Cómo Aplicar la Migración

### **Paso 1: Acceder a Supabase Dashboard**

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Abre el **SQL Editor** en el menú lateral

### **Paso 2: Ejecutar la Migración Principal**

1. Abre el archivo: `project/supabase/migrations/20250127000009_create_vencimientos_gestion_table.sql`
2. **Copia TODO el contenido** del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run** o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)
5. Espera a que termine la ejecución (puede tardar 30-60 segundos)

✅ **Resultado esperado:** Deberías ver "Success. No rows returned" o un mensaje similar

### **Paso 3: Ejecutar la Migración de Responsable**

1. Abre el archivo: `project/supabase/migrations/20250127000010_add_vencimientos_responsable_to_subforums.sql`
2. **Copia TODO el contenido** del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run** o presiona `Ctrl+Enter`
5. Espera a que termine la ejecución

✅ **Resultado esperado:** Deberías ver "Success. No rows returned" o un mensaje similar

---

## 🔍 Verificar que Funcionó

Después de ejecutar las migraciones, verifica que las tablas se crearon correctamente:

### 1. **Verificar Tabla Principal de Vencimientos**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'vencimientos_gestion';
```

**Resultado esperado:** Debe mostrar `vencimientos_gestion`

### 2. **Verificar Todas las Tablas del Sistema de Vencimientos**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'vencimientos_gestion',
  'vencimientos_gestion_assignments',
  'vencimientos_gestion_messages'
)
ORDER BY table_name;
```

**Resultado esperado:** Debe mostrar las 3 tablas listadas

### 3. **Verificar Columna en Subforums**

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'subforums' 
AND column_name = 'vencimientos_responsable_id';
```

**Resultado esperado:** Debe mostrar la columna `vencimientos_responsable_id` con tipo `uuid`

### 4. **Verificar Políticas RLS**

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('vencimientos_gestion', 'vencimientos_gestion_assignments', 'vencimientos_gestion_messages')
ORDER BY tablename, policyname;
```

**Resultado esperado:** Debe mostrar políticas RLS para cada tabla

---

## ⚠️ Si Ocurre un Error

### Error: "relation already exists"
- **Significa:** La tabla ya existe (migración parcial ejecutada)
- **Solución:** El script usa `CREATE TABLE IF NOT EXISTS`, así que es seguro ejecutarlo de nuevo

### Error: "permission denied"
- **Significa:** No tienes permisos suficientes
- **Solución:** Asegúrate de estar usando una cuenta con permisos de administrador en Supabase

### Error: "column already exists"
- **Significa:** La columna `vencimientos_responsable_id` ya existe en `subforums`
- **Solución:** El script usa `ADD COLUMN IF NOT EXISTS`, así que es seguro ejecutarlo de nuevo

---

## 📝 Notas Importantes

1. **Las migraciones son idempotentes:** Puedes ejecutarlas múltiples veces sin problemas (usan `IF NOT EXISTS`)

2. **No afecta datos existentes:** Solo crea nuevas tablas, columnas y políticas

3. **Tiempo estimado:** 30-60 segundos por migración dependiendo de tu conexión

4. **Después de ejecutar:** Recarga la aplicación web para que los cambios surtan efecto

5. **Schema Cache:** Si después de ejecutar las migraciones aún ves el error, espera unos segundos y recarga la página. El schema cache de Supabase puede tardar unos momentos en actualizarse.

---

## ✅ Después de Ejecutar

Una vez ejecutadas las migraciones:

1. **Recarga la aplicación** en el navegador (F5)
2. **Intenta crear vencimientos nuevamente**
3. Debería funcionar correctamente

Si aún hay problemas, verifica en la consola del navegador (F12) el error específico.

---

## 🔄 Refrescar Schema Cache (Si es necesario)

Si después de ejecutar las migraciones aún ves el error del schema cache:

1. Ve a **Settings** → **API** en Supabase Dashboard
2. Haz clic en **Refresh Schema Cache** (si está disponible)
3. O simplemente espera 1-2 minutos y recarga la aplicación

El schema cache de Supabase se actualiza automáticamente, pero puede tardar unos momentos.
