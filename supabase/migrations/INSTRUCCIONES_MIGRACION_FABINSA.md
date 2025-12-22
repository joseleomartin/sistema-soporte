# 📋 Instrucciones: Migración del Sistema Fabinsa

## ⚠️ IMPORTANTE: Ejecutar la Migración

El error "Could not find the table 'public.employees' in the schema cache" indica que la migración del sistema Fabinsa **no se ha ejecutado** en Supabase.

---

## 🚀 Cómo Aplicar la Migración

### **Paso 1: Acceder a Supabase Dashboard**

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Abre el **SQL Editor** en el menú lateral

### **Paso 2: Ejecutar la Migración**

1. Abre el archivo: `project/supabase/migrations/20250120000025_create_fabinsa_production_system.sql`
2. **Copia TODO el contenido** del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run** o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)
5. Espera a que termine la ejecución (puede tardar 30-60 segundos)

✅ **Resultado esperado:** Deberías ver "Success. No rows returned" o un mensaje similar

---

## 🔍 Verificar que Funcionó

Después de ejecutar la migración, verifica que las tablas se crearon correctamente:

### 1. **Verificar Tabla de Empleados**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'employees';
```

**Resultado esperado:** Debe mostrar `employees`

### 2. **Verificar Todas las Tablas del Sistema Fabinsa**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'products',
  'product_materials',
  'employees',
  'stock_materials',
  'stock_products',
  'resale_products',
  'sales',
  'purchases_materials',
  'purchases_products',
  'production_metrics',
  'inventory_movements'
)
ORDER BY table_name;
```

**Resultado esperado:** Debe mostrar las 11 tablas listadas

### 3. **Verificar Políticas RLS**

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'products', 'sales')
ORDER BY tablename, policyname;
```

**Resultado esperado:** Debe mostrar políticas RLS para cada tabla

### 4. **Verificar Función Helper**

```sql
SELECT proname 
FROM pg_proc 
WHERE proname = 'get_user_tenant_id';
```

**Resultado esperado:** Debe mostrar `get_user_tenant_id`

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
2. **Intenta crear un empleado nuevamente**
3. Debería funcionar correctamente

Si aún hay problemas, verifica en la consola del navegador (F12) el error específico.

