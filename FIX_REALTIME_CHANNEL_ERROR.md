# 🔧 Fix: Channel Subscription Error

## 🐛 Error

```
❌ Channel subscription error
```

Este error aparece en la consola cuando Realtime no puede suscribirse al canal de `task_messages`.

---

## 🔍 Causas Posibles

1. **Realtime no está habilitado** en la tabla `task_messages`
2. **Cuota de conexiones agotada** (plan gratuito tiene límites)
3. **Error de red** o timeout
4. **Configuración incorrecta** del proyecto Supabase

---

## ✅ Solución 1: Verificar Realtime en Supabase

### **Paso 1: Verificar si Realtime está Habilitado**

1. Ve a **SQL Editor** en Supabase Dashboard
2. Ejecuta esta query:

```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'task_messages';
```

**Resultado esperado:**
```
schemaname | tablename
-----------|---------------
public     | task_messages
```

**Si NO aparece nada**, ejecuta:

```sql
-- Agregar task_messages a Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE task_messages;
```

O usa el script de la migración que ya incluye verificación:

```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'task_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE task_messages;
        RAISE NOTICE 'Tabla task_messages agregada a supabase_realtime';
    ELSE
        RAISE NOTICE 'Tabla task_messages ya está en supabase_realtime';
    END IF;
END $$;
```

---

### **Paso 2: Habilitar Realtime desde el Dashboard**

1. Ve a **Database** → **Tables**
2. Click en la tabla **task_messages**
3. En la parte superior, busca el toggle **"Enable Realtime"**
4. Actívalo si está desactivado
5. ✅ Guarda los cambios

---

## ✅ Solución 2: Verificar Límites del Plan

### **Plan Gratuito de Supabase:**
- **Conexiones simultáneas**: ~200 (puede variar)
- **Mensajes por segundo**: 100

Si estás en el plan gratuito y tienes muchas conexiones, puedes alcanzar el límite.

### **Verificar uso:**
1. Ve a **Settings** → **Usage & Billing**
2. Mira la sección **Realtime**
3. Si estás cerca del límite, considera:
   - Cerrar pestañas/conexiones innecesarias
   - Upgrade al plan Pro
   - Optimizar las suscripciones

---

## ✅ Solución 3: Reintentar la Conexión

A veces es un problema temporal. Puedes agregar lógica de reintento:

```tsx
const subscribeToMessages = () => {
  console.log('🔔 Subscribing to task_messages for task:', taskId);
  
  let retryCount = 0;
  const maxRetries = 3;
  
  const attemptSubscription = () => {
    const channel = supabase
      .channel(`task_messages:${taskId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_messages',
          filter: `task_id=eq.${taskId}`
        },
        async (payload) => {
          // ... handler ...
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed');
          retryCount = 0; // Reset contador
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel subscription error');
          
          // Reintentar
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`🔄 Retrying... (${retryCount}/${maxRetries})`);
            setTimeout(() => {
              supabase.removeChannel(channel);
              attemptSubscription();
            }, 2000 * retryCount); // Backoff exponencial
          } else {
            console.error('❌ Max retries reached. Giving up.');
          }
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Subscription timed out');
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(() => attemptSubscription(), 3000);
          }
        }
      });
    
    return channel;
  };
  
  const channel = attemptSubscription();
  
  return () => {
    console.log('🔌 Unsubscribing from task_messages channel');
    supabase.removeChannel(channel);
  };
};
```

---

## ✅ Solución 4: Verificar Conectividad

### **Probar conexión a Supabase:**

```tsx
// Agregar esto temporalmente en useEffect
useEffect(() => {
  const testConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('task_messages')
        .select('count')
        .limit(1);
      
      console.log('✅ Database connection OK:', data);
      if (error) console.error('❌ Database error:', error);
    } catch (error) {
      console.error('❌ Connection error:', error);
    }
  };
  
  testConnection();
}, []);
```

---

## 🔍 Debugging Completo

Agrega logs detallados para ver qué está pasando:

```tsx
useEffect(() => {
  console.log('🔄 Component mounted, taskId:', taskId);
  console.log('👤 Current user:', profile?.id);
  console.log('🔗 Supabase URL:', supabase.supabaseUrl);
  
  fetchMessages();
  const cleanup = subscribeToMessages();
  
  return () => {
    console.log('🧹 Component unmounting, cleaning up...');
    cleanup();
  };
}, [taskId]);
```

---

## 🔍 Verificar en Supabase Dashboard

### **1. Ver conexiones activas:**

```sql
SELECT 
    datname,
    count(*) as connections
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY datname;
```

### **2. Ver suscripciones activas:**

```sql
SELECT * FROM pg_stat_replication;
```

### **3. Ver configuración de Realtime:**

```sql
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';
```

---

## ⚠️ Errores Comunes

### **Error: "Realtime is not enabled for this project"**

**Solución:**
1. Ve a **Settings** → **API**
2. Verifica que Realtime está habilitado
3. Si no lo está, actívalo desde el toggle

---

### **Error: "Too many connections"**

**Solución:**
1. Cierra pestañas duplicadas
2. Asegúrate de limpiar las suscripciones al desmontar componentes
3. Usa un solo canal por componente

---

### **Error: "CORS error"**

**Solución:**
1. Ve a **Settings** → **API**
2. Verifica que tu dominio está en la lista de orígenes permitidos
3. Para desarrollo local, agrega `http://localhost:5173` (o tu puerto)

---

## 📊 Estados de Suscripción

| Estado | Significado | Acción |
|--------|-------------|--------|
| `SUBSCRIBED` | ✅ Conectado correctamente | Todo funciona |
| `CHANNEL_ERROR` | ❌ Error al conectar | Ver soluciones arriba |
| `TIMED_OUT` | ⏱️ Timeout de conexión | Problema de red, reintentar |
| `CLOSED` | 🔌 Canal cerrado | Normal al desmontar |

---

## ✅ Checklist de Verificación

- [ ] `task_messages` está en `supabase_realtime` (query SQL)
- [ ] Realtime está habilitado en el Dashboard
- [ ] No estás excediendo los límites de tu plan
- [ ] La consola muestra `📡 Subscription status: SUBSCRIBED`
- [ ] No hay errores de CORS
- [ ] No hay errores de red
- [ ] Las políticas RLS permiten leer `task_messages`
- [ ] El usuario está autenticado

---

## 🎯 Resultado Esperado

Cuando funciona correctamente, en la consola deberías ver:

```
🔔 Subscribing to task_messages for task: abc-123
📡 Subscription status: SUBSCRIBED
✅ Successfully subscribed to task_messages
```

Cuando llega un mensaje:

```
📨 New message received via Realtime: { new: { ... } }
✅ Adding message to state: { id: "...", message: "hola" }
```

---

## 🚀 Después del Fix

Una vez que Realtime funcione:
- ✅ Los mensajes aparecerán instantáneamente
- ✅ No necesitarás recargar la página
- ✅ Múltiples usuarios pueden chatear simultáneamente

---

## 📖 Documentación Relacionada

- **Supabase Realtime Docs**: https://supabase.com/docs/guides/realtime
- **Row Level Security**: https://supabase.com/docs/guides/database/postgres/row-level-security
- **Storage Buckets**: `CREAR_BUCKET_STORAGE.md`

---

## 🎉 ¡Listo!

Ahora Realtime debería funcionar correctamente. Si sigues teniendo problemas, revisa los logs de Supabase en el Dashboard (Settings → Logs).



