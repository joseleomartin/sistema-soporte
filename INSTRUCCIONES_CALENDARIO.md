# 📅 Sistema de Calendario - Instrucciones de Instalación

## 🎯 Funcionalidades Implementadas

### Para Todos los Usuarios:
- ✅ Crear eventos personales
- ✅ Ver sus propios eventos en el calendario
- ✅ Editar/eliminar sus eventos personales
- ✅ Ver eventos asignados por admin/support

### Para Admin y Support:
- ✅ Crear eventos personales
- ✅ **Crear eventos y asignarlos a usuarios específicos**
- ✅ Los eventos asignados se suman a los eventos personales del usuario
- ✅ Ver y gestionar todos los eventos

## 🔧 Instalación

### Paso 1: Aplicar Migración de Base de Datos

Abre el **SQL Editor** en tu dashboard de Supabase y ejecuta el siguiente script:

```sql
/*
  # Crear tabla de eventos de calendario
*/

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  all_day boolean DEFAULT false,
  color text DEFAULT '#3B82F6',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'personal' CHECK (event_type IN ('personal', 'assigned', 'meeting')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_to ON calendar_events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios pueden ver sus eventos personales
CREATE POLICY "Users can view own personal events"
  ON calendar_events
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() AND assigned_to IS NULL
  );

-- Policy: Usuarios pueden ver eventos asignados a ellos
CREATE POLICY "Users can view events assigned to them"
  ON calendar_events
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
  );

-- Policy: Admin y support pueden ver todos los eventos
CREATE POLICY "Admin and support can view all events"
  ON calendar_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Policy: Usuarios pueden crear eventos personales
CREATE POLICY "Users can create personal events"
  ON calendar_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND assigned_to IS NULL
  );

-- Policy: Admin y support pueden crear eventos para cualquier usuario
CREATE POLICY "Admin and support can create events for users"
  ON calendar_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Policy: Usuarios pueden actualizar sus propios eventos personales
CREATE POLICY "Users can update own personal events"
  ON calendar_events
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() AND assigned_to IS NULL
  )
  WITH CHECK (
    created_by = auth.uid() AND assigned_to IS NULL
  );

-- Policy: Admin y support pueden actualizar cualquier evento
CREATE POLICY "Admin and support can update all events"
  ON calendar_events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Policy: Usuarios pueden eliminar sus propios eventos personales
CREATE POLICY "Users can delete own personal events"
  ON calendar_events
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() AND assigned_to IS NULL
  );

-- Policy: Admin y support pueden eliminar cualquier evento
CREATE POLICY "Admin and support can delete all events"
  ON calendar_events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();
```

### Paso 2: Verificar la Instalación

Después de ejecutar el script, verifica que:
1. La tabla `calendar_events` existe
2. Todas las políticas RLS están activas
3. Los índices fueron creados

## 📖 Cómo Usar

### Usuario Normal:

1. **Ver el calendario**: En el Dashboard, verás un calendario en la parte izquierda
2. **Crear evento personal**: 
   - Click en cualquier día del calendario
   - Click en "+ Agregar evento"
   - Llena el formulario y guarda
3. **Ver eventos**: Los días con eventos muestran puntos de colores:
   - 🔵 Punto azul = Evento personal
   - 🟣 Punto púrpura = Evento asignado por admin/support

### Admin o Support:

1. **Crear evento personal**: Igual que usuario normal
2. **Asignar evento a usuario**:
   - Click en un día del calendario
   - Click en "+ Agregar evento"
   - Llena el formulario
   - En "Asignar a usuario" selecciona un usuario
   - El evento aparecerá en el calendario del usuario seleccionado

## 🎨 Características del Calendario

### Indicadores Visuales:
- **Día actual**: Fondo azul
- **Día seleccionado**: Fondo azul claro
- **Días con eventos**: Puntos de colores debajo del número
  - Máximo 3 puntos visibles
  - Azul = Personal
  - Púrpura = Asignado

### Colores Disponibles:
- 🔵 Azul (predeterminado)
- 🟣 Púrpura
- 🟢 Verde
- 🟠 Naranja
- 🔴 Rojo
- ⚫ Gris

### Tipos de Eventos:
1. **Personal**: Creado por el usuario para sí mismo
2. **Asignado**: Creado por admin/support para un usuario
3. **Meeting**: (Reservado para futuras funcionalidades)

## 🔒 Permisos y Seguridad

### Usuario Normal:
- ✅ Puede ver sus eventos personales
- ✅ Puede ver eventos asignados a él
- ✅ Puede crear eventos personales
- ✅ Puede editar/eliminar sus eventos personales
- ❌ No puede editar/eliminar eventos asignados
- ❌ No puede asignar eventos a otros usuarios

### Admin y Support:
- ✅ Puede ver todos los eventos
- ✅ Puede crear eventos personales
- ✅ Puede crear eventos y asignarlos a cualquier usuario
- ✅ Puede editar/eliminar cualquier evento
- ✅ Puede ver lista de usuarios para asignar eventos

## 📊 Estructura de Datos

### Tabla: calendar_events

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | ID único del evento |
| title | text | Título del evento (requerido) |
| description | text | Descripción opcional |
| start_date | timestamptz | Fecha y hora de inicio |
| end_date | timestamptz | Fecha y hora de fin (opcional) |
| all_day | boolean | Si es evento de todo el día |
| color | text | Color del evento (hex) |
| created_by | uuid | Usuario que creó el evento |
| assigned_to | uuid | Usuario al que está asignado (null = personal) |
| event_type | text | 'personal', 'assigned', o 'meeting' |
| created_at | timestamptz | Fecha de creación |
| updated_at | timestamptz | Fecha de última actualización |

## 🔄 Flujo de Eventos

### Evento Personal:
```
Usuario crea evento
  ↓
assigned_to = NULL
event_type = 'personal'
  ↓
Solo visible para el usuario que lo creó
```

### Evento Asignado:
```
Admin/Support crea evento
  ↓
Selecciona usuario en "Asignar a usuario"
  ↓
assigned_to = ID del usuario seleccionado
event_type = 'assigned'
  ↓
Visible para:
- El usuario asignado
- Admin y support (pueden ver todos)
```

### Combinación de Eventos:
```
Usuario ve en su calendario:
- Sus eventos personales (azul)
- Eventos asignados a él (púrpura)
- Ambos tipos se suman, no se reemplazan
```

## 🎯 Ejemplo de Uso

### Escenario: Admin asigna tarea a usuario

1. **Admin** entra al Dashboard
2. Click en día 15 de noviembre
3. Click en "+ Agregar evento"
4. Llena:
   - Título: "Revisar extractos bancarios"
   - Descripción: "Revisar y procesar extractos del mes"
   - Hora: 09:00 - 11:00
   - Color: Naranja
   - **Asignar a usuario**: Selecciona "Juan Pérez"
5. Guarda

**Resultado:**
- Admin ve el evento en su calendario (como creador)
- Juan Pérez ve el evento en su calendario (como asignado)
- El evento aparece con punto púrpura en el calendario de Juan
- Juan puede ver que fue "Asignado por: Admin"
- Juan NO puede editar ni eliminar este evento
- Juan puede crear sus propios eventos personales que se suman a este

## 🐛 Troubleshooting

### Error: "Cannot find table calendar_events"
- **Solución**: Ejecuta el script SQL del Paso 1

### Los eventos no aparecen
- **Solución**: Verifica que las políticas RLS estén activas
- Verifica que el usuario tenga sesión activa

### No puedo asignar eventos a usuarios
- **Solución**: Verifica que tu rol sea 'admin' o 'support'
- Solo estos roles pueden asignar eventos

### Los eventos asignados no aparecen
- **Solución**: Verifica que `assigned_to` tenga el ID correcto del usuario
- Verifica las políticas RLS

## 📝 Próximas Mejoras Sugeridas

1. **Notificaciones**: Notificar al usuario cuando se le asigna un evento
2. **Recordatorios**: Enviar recordatorios antes del evento
3. **Eventos recurrentes**: Crear eventos que se repiten
4. **Vista semanal/mensual**: Diferentes vistas del calendario
5. **Exportar a Google Calendar**: Integración con calendarios externos
6. **Eventos de reunión**: Integrar con las salas de reunión
7. **Drag & drop**: Mover eventos arrastrando
8. **Compartir eventos**: Compartir eventos con múltiples usuarios

---

**¡El sistema de calendario está listo para usar!** 📅✨































