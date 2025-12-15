# 🚀 Nueva Funcionalidad: Procesamiento en Segundo Plano

## ✨ ¿Qué hay de nuevo?

El sistema de extracción de extractos bancarios ahora procesa los archivos **en segundo plano**, lo que significa que:

### ✅ Beneficios

1. **No necesitas esperar** - Inicia la extracción y navega libremente por la aplicación
2. **Procesa múltiples archivos** - Puedes enviar varios PDFs a la vez
3. **Notificaciones en tiempo real** - Panel flotante muestra el progreso
4. **Indicador visual** - Badge en el menú "Herramientas" muestra trabajos activos
5. **Descarga cuando esté listo** - Accede a los archivos desde cualquier lugar

## 🎯 Cómo Funciona

### 1. Iniciar Extracción

1. Ve a **Herramientas** → **Extractor de Tablas**
2. Selecciona el banco
3. Carga el PDF
4. Haz clic en **"Extraer Datos"**
5. ✅ ¡Listo! Puedes navegar a otras secciones

### 2. Monitorear Progreso

**Panel de Notificaciones (esquina inferior derecha):**
- 📊 Muestra todos los trabajos en proceso
- ⏱️ Barra de progreso en tiempo real
- ✅ Indica cuando termina cada extracción
- ❌ Muestra errores si algo falla

**Sidebar (menú izquierdo):**
- 🔵 Badge numérico en "Herramientas"
- Indica cuántos archivos se están procesando
- Animación pulsante para llamar la atención

### 3. Descargar Resultados

Cuando un trabajo termina:
1. Verás una notificación verde en el panel
2. Botón **"Descargar Excel"** aparece automáticamente
3. Haz clic para descargar tu archivo
4. El trabajo permanece en el historial hasta que lo elimines

## 📋 Características del Panel de Notificaciones

### Minimizar/Expandir
- Haz clic en **▼** para minimizar el panel
- Haz clic en **▲** para expandir
- El panel se mantiene visible incluso minimizado si hay trabajos activos

### Gestión de Trabajos
- **✕** - Eliminar un trabajo individual
- **Limpiar** - Eliminar todos los trabajos completados a la vez
- Historial de últimos 5 trabajos

### Información Mostrada
- 📄 Nombre del archivo PDF
- 🏦 Banco seleccionado
- 📊 Barra de progreso
- 💬 Mensaje de estado
- ⏱️ Orden cronológico (más reciente arriba)

## 🎨 Estados Visuales

### 🔵 Procesando
- Icono: Spinner animado
- Color: Azul
- Barra de progreso activa
- Mensaje: "Cargando archivo...", "Procesando PDF..."

### ✅ Completado
- Icono: Check verde
- Color: Verde
- Botón de descarga visible
- Mensaje: "✅ X registros extraídos"

### ❌ Error
- Icono: Alerta roja
- Color: Rojo
- Mensaje descriptivo del error
- Opción de eliminar del historial

## 💡 Casos de Uso

### Caso 1: Procesar múltiples extractos
```
1. Carga Extracto_Enero.pdf → Inicia procesamiento
2. Inmediatamente carga Extracto_Febrero.pdf → Inicia procesamiento
3. Carga Extracto_Marzo.pdf → Inicia procesamiento
4. Ve a Dashboard mientras se procesan
5. Vuelve cuando el badge indique que terminaron
6. Descarga los 3 archivos Excel
```

### Caso 2: Procesar y trabajar
```
1. Carga extracto bancario → Inicia procesamiento
2. Ve a Tickets para responder consultas
3. Panel de notificaciones muestra progreso
4. Cuando termina, aparece notificación
5. Descargas sin perder tu trabajo en Tickets
```

### Caso 3: Procesar durante reunión
```
1. Inicias extracción de varios PDFs
2. Entras a una Sala de Reunión
3. Participas en la reunión normalmente
4. Panel muestra cuando terminan las extracciones
5. Al salir de la reunión, descargas todos los archivos
```

## 🔧 Detalles Técnicos

### Arquitectura

```
┌─────────────────────────┐
│  TableExtractor.tsx     │  Formulario de carga
│  (Componente)           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  ExtractionContext      │  Estado global de trabajos
│  (React Context)        │
└───────────┬─────────────┘
            │
            ├──────────────────┐
            ▼                  ▼
┌─────────────────┐  ┌─────────────────────┐
│ Notifications   │  │ Sidebar Badge       │
│ (Panel flotante)│  │ (Indicador visual)  │
└─────────────────┘  └─────────────────────┘
```

### Contexto Global: `ExtractionContext`

**Propósito:** Mantener estado de todos los trabajos de extracción

**API:**
- `jobs` - Array de todos los trabajos
- `activeJobsCount` - Contador de trabajos activos
- `addJob(job)` - Crear nuevo trabajo
- `updateJob(id, updates)` - Actualizar trabajo existente
- `removeJob(id)` - Eliminar trabajo
- `clearCompletedJobs()` - Limpiar completados
- `getJob(id)` - Obtener trabajo específico

### Interfaz de Job

```typescript
interface ExtractionJob {
  id: string;              // Identificador único
  banco: string;           // ID del banco
  bancoName: string;       // Nombre del banco
  filename: string;        // Nombre del archivo PDF
  status: 'processing' | 'completed' | 'error';
  progress: number;        // 0-100
  message?: string;        // Mensaje de estado
  downloadUrl?: string;    // URL de descarga (cuando está listo)
  rows?: number;          // Cantidad de registros extraídos
  timestamp: number;       // Timestamp de creación
}
```

## 🎭 Flujo Completo

```mermaid
1. Usuario carga PDF
   ↓
2. Se crea Job en ExtractionContext
   ↓
3. Aparece notificación: "Extracción iniciada"
   ↓
4. Formulario se limpia (listo para otro archivo)
   ↓
5. Panel flotante muestra progreso
   ↓
6. Badge en sidebar muestra contador
   ↓
7. Usuario puede navegar libremente
   ↓
8. Backend procesa PDF
   ↓
9. Job se actualiza: progress 10% → 50% → 100%
   ↓
10. Status cambia a 'completed'
    ↓
11. Aparece botón de descarga
    ↓
12. Usuario descarga Excel
    ↓
13. Job permanece en historial
    ↓
14. Usuario puede eliminar o limpiar trabajos
```

## 🔒 Consideraciones de Rendimiento

### Optimizaciones Implementadas

1. **Límite de historial:** Solo se muestran últimos 5 trabajos en panel
2. **Estado local:** Trabajos se mantienen en memoria (React state)
3. **Actualización eficiente:** Solo componentes afectados se re-renderizan
4. **Limpieza manual:** Usuario controla cuándo limpiar historial

### Recomendaciones

- ⚠️ No iniciar más de 5-10 extracciones simultáneas
- 🧹 Limpiar trabajos completados regularmente
- 💾 Descargar archivos antes de cerrar el navegador
- 🔄 Refrescar página si hay problemas de memoria

## 🆕 Componentes Nuevos

### 1. `ExtractionContext.tsx`
- Contexto global de React
- Gestiona estado de todos los trabajos
- Provee API para manipular trabajos

### 2. `ExtractionNotifications.tsx`
- Panel flotante en esquina inferior derecha
- Muestra progreso y resultados
- Permite descargar archivos
- Gestión de historial

### 3. Badge en Sidebar
- Indicador visual en menú "Herramientas"
- Muestra contador de trabajos activos
- Animación pulsante

## 🔄 Cambios en Componentes Existentes

### `TableExtractor.tsx`
- **Antes:** Bloqueaba UI mientras procesaba
- **Ahora:** Inicia trabajo y libera UI inmediatamente
- Usa `useExtraction()` hook
- Limpia formulario después de enviar

### `App.tsx`
- Integra `ExtractionProvider`
- Agrega `ExtractionNotifications` al layout

### `Sidebar.tsx`
- Usa `useExtraction()` para obtener contador
- Muestra badge cuando hay trabajos activos

## 📱 Experiencia de Usuario

### Antes (Sin Segundo Plano)
❌ Usuario carga PDF
❌ Espera 30-60 segundos sin poder hacer nada
❌ No puede procesar múltiples archivos
❌ Pierde el resultado si navega

### Ahora (Con Segundo Plano)
✅ Usuario carga PDF
✅ Inicia procesamiento y sigue trabajando
✅ Puede procesar múltiples archivos
✅ Ve progreso en tiempo real
✅ Descarga cuando esté listo, desde cualquier lugar

## 🎉 Beneficios Clave

1. **Productividad** - No esperas, sigues trabajando
2. **Paralelismo** - Procesa varios archivos a la vez
3. **Visibilidad** - Siempre sabes qué está pasando
4. **Flexibilidad** - Descargas cuando quieras
5. **Sin pérdidas** - Historial persiste mientras navegas

## 🚀 Próximas Mejoras Potenciales

- [ ] Persistir trabajos en localStorage
- [ ] Notificaciones del navegador (Web Push)
- [ ] Sonido cuando termina un trabajo
- [ ] Estimación de tiempo restante
- [ ] Prioridad de trabajos
- [ ] Pausar/reanudar procesamiento
- [ ] Historial persistente en base de datos
- [ ] Estadísticas de uso

---

**Versión:** 1.1.0
**Fecha:** 11 de Noviembre, 2025
**Característica:** Procesamiento en Segundo Plano
**Estado:** ✅ Implementado y Funcional





















