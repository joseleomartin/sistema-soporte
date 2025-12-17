# 👥 Contador de Usuarios Conectados en Salas de Reunión

## 🎯 Funcionalidad Implementada

Se ha agregado un **contador en tiempo real** que muestra cuántos usuarios están conectados en cada sala de reunión en el momento actual.

---

## ✅ Características

### 1. **Contador en Tiempo Real**
- ✅ Muestra el número exacto de usuarios conectados
- ✅ Se actualiza automáticamente cuando alguien entra o sale
- ✅ Usa Supabase Realtime para actualizaciones instantáneas

### 2. **Visualización Clara**
```
┌────────────────────────────────────┐
│ 📹 Nombre de la Sala               │
│    Descripción...                  │
│                                    │
│ 👥 3 conectados    Unirse ahora → │
└────────────────────────────────────┘
```

### 3. **Estados Visuales**

#### Con Usuarios Conectados:
```
👥 3 conectados
[Badge verde con fondo verde claro]
```

#### Sin Usuarios:
```
👥 Sin usuarios
[Texto gris simple]
```

---

## 🔧 Implementación Técnica

### 1. **Nueva Tabla: `room_presence`**

```sql
CREATE TABLE room_presence (
    id UUID PRIMARY KEY,
    room_id UUID REFERENCES meeting_rooms(id),
    user_id UUID REFERENCES profiles(id),
    user_name TEXT,
    joined_at TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    UNIQUE(room_id, user_id)
);
```

**Campos:**
- `room_id`: ID de la sala
- `user_id`: ID del usuario conectado
- `user_name`: Nombre del usuario
- `joined_at`: Cuándo entró a la sala
- `last_seen`: Última actividad (heartbeat)

### 2. **Sistema de Heartbeat**

Cuando un usuario entra a una sala:
1. Se registra en `room_presence`
2. Cada 30 segundos actualiza `last_seen`
3. Al salir, se elimina el registro

### 3. **Limpieza Automática**

Usuarios inactivos (sin heartbeat por >5 minutos) se consideran desconectados:
```sql
DELETE FROM room_presence
WHERE last_seen < NOW() - INTERVAL '5 minutes';
```

### 4. **Realtime Updates**

El componente se suscribe a cambios en `room_presence`:
```typescript
supabase
  .channel('room_presence_changes')
  .on('postgres_changes', { table: 'room_presence' }, () => {
    loadRooms(); // Actualizar contadores
  })
  .subscribe();
```

---

## 📊 Flujo de Funcionamiento

### Cuando un Usuario Entra:

```
1. Usuario hace clic en "Unirse Aquí"
   ↓
2. Se registra en room_presence
   ↓
3. Inicia heartbeat cada 30 segundos
   ↓
4. Otros usuarios ven el contador actualizado
```

### Mientras Está Conectado:

```
Cada 30 segundos:
  → Actualiza last_seen en room_presence
  → Mantiene presencia activa
```

### Cuando Sale:

```
1. Usuario cierra la sala o sale
   ↓
2. Se ejecuta cleanup (useEffect return)
   ↓
3. Se elimina de room_presence
   ↓
4. Contador se actualiza para otros usuarios
```

---

## 🎨 Componentes Modificados

### 1. **MeetingRoomsList.tsx**

**Cambios:**
- ✅ Nueva interfaz `RoomWithPresence`
- ✅ Carga contador de usuarios por sala
- ✅ Suscripción a cambios en tiempo real
- ✅ Visualización del contador en tarjetas

**Código clave:**
```typescript
const { count } = await supabase
  .from('room_presence')
  .select('*', { count: 'exact', head: true })
  .eq('room_id', room.id)
  .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString());
```

### 2. **MeetingRoom.tsx**

**Cambios:**
- ✅ Registra presencia al entrar
- ✅ Heartbeat cada 30 segundos
- ✅ Limpieza al salir

**Código clave:**
```typescript
useEffect(() => {
  if (!showIframe) return;
  
  // Registrar presencia
  registerPresence();
  
  // Heartbeat
  const interval = setInterval(registerPresence, 30000);
  
  // Cleanup
  return () => {
    clearInterval(interval);
    removePresence();
  };
}, [showIframe]);
```

---

## 🔒 Seguridad (RLS Policies)

### Políticas Implementadas:

1. **Ver presencias:** ✅ Todos pueden ver
```sql
CREATE POLICY "Anyone can view room presence"
FOR SELECT USING (true);
```

2. **Insertar:** ✅ Solo su propia presencia
```sql
CREATE POLICY "Users can insert their own presence"
FOR INSERT WITH CHECK (auth.uid() = user_id);
```

3. **Actualizar:** ✅ Solo su propia presencia
```sql
CREATE POLICY "Users can update their own presence"
FOR UPDATE USING (auth.uid() = user_id);
```

4. **Eliminar:** ✅ Solo su propia presencia
```sql
CREATE POLICY "Users can delete their own presence"
FOR DELETE USING (auth.uid() = user_id);
```

---

## 📈 Rendimiento

### Optimizaciones:

1. **Índices en BD:**
```sql
CREATE INDEX idx_room_presence_room_id ON room_presence(room_id);
CREATE INDEX idx_room_presence_last_seen ON room_presence(last_seen);
```

2. **Consultas Eficientes:**
- Uso de `count` con `head: true` (no descarga datos)
- Filtro por `last_seen` para excluir inactivos
- Carga paralela con `Promise.all`

3. **Heartbeat Optimizado:**
- Solo actualiza `last_seen` (no toda la fila)
- Intervalo de 30 segundos (balance entre precisión y carga)

---

## 💡 Casos de Uso

### Caso 1: Usuario Busca Sala Activa
```
Usuario ve lista de salas:
  - Sala A: 👥 5 conectados ← "Hay gente aquí"
  - Sala B: 👥 Sin usuarios
  - Sala C: 👥 1 conectado

Usuario elige Sala A porque hay actividad
```

### Caso 2: Coordinación de Reuniones
```
Admin crea sala para reunión
Envía link a equipo
Usuarios ven: 👥 3 conectados
Saben que otros ya están esperando
```

### Caso 3: Monitoreo de Actividad
```
Soporte ve dashboard:
  - Sala Cliente A: 👥 2 conectados
  - Sala Cliente B: 👥 Sin usuarios
  - Sala Interna: 👥 4 conectados

Puede ver dónde hay actividad en tiempo real
```

---

## 🎨 Diseño Visual

### Badge de Usuarios Conectados:

**Con usuarios (Verde):**
```css
background: bg-green-100
color: text-green-700
border-radius: rounded-full
padding: px-2.5 py-1
```

**Sin usuarios (Gris):**
```css
color: text-gray-500
sin background especial
```

### Animaciones:
- ✅ Transiciones suaves al actualizar
- ✅ Badge pulsante cuando hay usuarios
- ✅ Hover effects en tarjetas

---

## 🔧 Mantenimiento

### Limpieza de Presencias Antiguas

**Función SQL:**
```sql
CREATE FUNCTION clean_old_room_presence()
RETURNS void AS $$
BEGIN
    DELETE FROM room_presence
    WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;
```

**Ejecución recomendada:**
- Manualmente cuando sea necesario
- O configurar cron job en Supabase

### Monitoreo

**Queries útiles:**
```sql
-- Ver todas las presencias activas
SELECT * FROM room_presence
WHERE last_seen > NOW() - INTERVAL '5 minutes';

-- Contar usuarios por sala
SELECT room_id, COUNT(*) as users
FROM room_presence
WHERE last_seen > NOW() - INTERVAL '5 minutes'
GROUP BY room_id;

-- Ver presencias antiguas (para limpiar)
SELECT * FROM room_presence
WHERE last_seen < NOW() - INTERVAL '5 minutes';
```

---

## 📱 Experiencia de Usuario

### Antes:
```
[Tarjeta de Sala]
📹 Nombre de la Sala
Descripción...
👥 Sala permanente
```
**Usuario piensa:** "¿Hay alguien conectado?"

### Ahora:
```
[Tarjeta de Sala]
📹 Nombre de la Sala
Descripción...
👥 3 conectados [Badge verde]
```
**Usuario piensa:** "¡Hay 3 personas! Voy a unirme"

---

## 🚀 Beneficios

### Para Usuarios:
- ✅ Saben si hay actividad en la sala
- ✅ Pueden elegir salas con gente
- ✅ Evitan entrar a salas vacías
- ✅ Mejor coordinación de reuniones

### Para Administradores:
- ✅ Monitoreo de uso en tiempo real
- ✅ Identificar salas populares
- ✅ Detectar problemas de conectividad
- ✅ Estadísticas de participación

### Para el Sistema:
- ✅ Datos de uso en tiempo real
- ✅ Métricas de actividad
- ✅ Base para futuras funcionalidades
- ✅ Mejor experiencia general

---

## 🔄 Actualizaciones en Tiempo Real

### Escenarios:

**Escenario 1: Usuario A entra**
```
1. Usuario A hace clic en "Unirse"
2. Se registra en room_presence
3. Usuario B (viendo lista) ve: 👥 0 → 👥 1
```

**Escenario 2: Usuario A sale**
```
1. Usuario A cierra la sala
2. Se elimina de room_presence
3. Usuario B ve: 👥 1 → 👥 0
```

**Escenario 3: Múltiples usuarios**
```
1. 5 usuarios entran progresivamente
2. Cada entrada actualiza el contador
3. Todos ven: 👥 1 → 👥 2 → 👥 3 → 👥 4 → 👥 5
```

---

## 📊 Archivos Creados/Modificados

### Nuevos:
1. ✅ `supabase/migrations/20251111190000_create_room_presence_table.sql`
   - Tabla room_presence
   - Índices
   - Políticas RLS
   - Función de limpieza

2. ✅ `CONTADOR_USUARIOS_SALAS.md` (este archivo)
   - Documentación completa

### Modificados:
1. ✅ `src/components/Meetings/MeetingRoomsList.tsx`
   - Carga de contadores
   - Realtime subscription
   - Visualización

2. ✅ `src/components/Meetings/MeetingRoom.tsx`
   - Registro de presencia
   - Heartbeat system
   - Cleanup

---

## ✅ Checklist de Implementación

- [x] Tabla `room_presence` creada
- [x] Índices para rendimiento
- [x] Políticas RLS configuradas
- [x] Función de limpieza
- [x] Registro de presencia al entrar
- [x] Sistema de heartbeat (30s)
- [x] Limpieza al salir
- [x] Contador en lista de salas
- [x] Realtime updates
- [x] Visualización con badges
- [x] Estados (con/sin usuarios)
- [x] Sin errores de linting
- [x] Documentación completa

---

## 🎉 Resultado Final

**El sistema ahora muestra en tiempo real cuántos usuarios están conectados en cada sala de reunión, mejorando significativamente la experiencia de usuario y la coordinación de reuniones.**

### Ejemplo Visual:

```
┌─────────────────────────────────────────┐
│ 📹 Junta 1                              │
│    Recuerda abrir el micrófono...       │
│                                         │
│ 👥 3 conectados      Unirse ahora →    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📹 Sala de Soporte                      │
│    Para consultas del equipo            │
│                                         │
│ 👥 Sin usuarios      Unirse ahora →    │
└─────────────────────────────────────────┘
```

---

**Versión:** 1.0.0  
**Fecha:** 11 de Noviembre, 2025  
**Estado:** ✅ Implementado y Funcional






















