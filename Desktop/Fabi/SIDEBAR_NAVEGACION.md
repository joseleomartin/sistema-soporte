# 🎯 Barra Lateral de Navegación - FABINSA CONTROL

## Nuevo Sistema de Navegación con Sidebar

Se ha implementado una **barra lateral izquierda moderna** para la navegación entre secciones, reemplazando las pestañas horizontales tradicionales por un sistema más profesional y espacioso.

---

## 🎨 Características del Sidebar

### 📐 Diseño y Dimensiones
- **Ancho:** 240px (fijo)
- **Color de fondo:** `#1e293b` (azul oscuro profesional)
- **Borde derecho:** 2px en color primary (`#6366f1`)
- **Posición:** Fija en el lado izquierdo

### 🎯 Estructura del Sidebar

#### 1. **Header del Sidebar**
```
┌─────────────────────────┐
│   📋 NAVEGACIÓN         │
│   ═══════════════       │  ← Separador primary (3px)
└─────────────────────────┘
```
- Título: "📋 NAVEGACIÓN"
- Fuente: Segoe UI, 13px bold
- Color: Blanco
- Padding: 20px vertical

#### 2. **Botones de Navegación**
Cada botón tiene:
- **Indicador lateral:** Barra de 4px de ancho
  - Inactivo: Transparente (mismo color que fondo)
  - Activo: Color accent (`#ec4899` - rosa vibrante)
  
- **Área del botón:**
  - Icono emoji + Texto
  - Fuente: Segoe UI, 11px bold
  - Padding: 18px horizontal, 16px vertical
  - Cursor: Pointer (mano)

#### 3. **Footer del Sidebar**
```
┌─────────────────────────┐
│   ─────────────────     │  ← Separador sutil
│   v2.0 Premium          │
│   © 2024 FABINSA        │
└─────────────────────────┘
```
- Versión del sistema
- Copyright
- Fuente: Segoe UI, 8px
- Color: Gris claro (`text_muted`)

---

## 🎭 Estados Visuales de los Botones

### 1️⃣ Estado Normal (Inactivo)
- **Background:** `#1e293b` (bg_darker)
- **Texto:** Blanco
- **Indicador:** Transparente (mismo bg)

### 2️⃣ Estado Hover (Mouse sobre el botón)
- **Background:** `#4f46e5` (primary_hover)
- **Texto:** Blanco
- **Indicador:** Sin cambio
- **Cursor:** Mano (pointer)

### 3️⃣ Estado Activo (Sección seleccionada)
- **Background:** `#6366f1` (primary_color)
- **Texto:** Blanco
- **Indicador:** `#ec4899` (accent_color - rosa vibrante)

---

## 📋 Secciones de Navegación

| # | Icono | Nombre | Descripción |
|---|-------|--------|-------------|
| 1 | 🏭 | **Producción** | Gestión de productos a fabricar |
| 2 | 👥 | **Empleados** | Administración de personal |
| 3 | 📦 | **Stock** | Control de inventario (MP, Fabricados, Reventa) |
| 4 | 📊 | **Métricas** | Análisis y estadísticas |
| 5 | 💵 | **Ventas** | Registro de ventas |
| 6 | 💰 | **Costos** | Planilla de costos y simulaciones |

---

## 🔧 Funcionalidad Técnica

### Cambio de Pestaña
```python
def cambiar_tab(self, index):
    # Selecciona la pestaña en el Notebook
    self.tabs.select(index)
    
    # Actualiza el índice actual
    self.current_tab_index = index
    
    # Actualiza estilos visuales:
    # - Botón activo: primary_color
    # - Indicador activo: accent_color
    # - Botones inactivos: bg_darker
```

### Efectos Interactivos
- **Mouse Enter:** Cambia fondo a `primary_hover`
- **Mouse Leave:** Restaura fondo original (si no está activo)
- **Click:** Cambia de sección y actualiza estilos

---

## 🎨 Ventajas del Diseño con Sidebar

### ✅ Ventajas Visuales
1. **Más espacio horizontal** para el contenido principal
2. **Navegación siempre visible** - no necesitas cambiar de pestaña
3. **Jerarquía clara** - la sección actual está destacada
4. **Look profesional** similar a VS Code, Discord, Slack

### ✅ Ventajas UX
1. **Navegación más intuitiva** - vertical es más natural
2. **Indicadores visuales claros** - barra lateral activa
3. **Hover effects** - feedback inmediato
4. **Iconos descriptivos** - identificación rápida

### ✅ Ventajas Técnicas
1. **Notebook oculto** - tabs invisibles, controlados por sidebar
2. **Código modular** - fácil agregar/quitar secciones
3. **Estado centralizado** - `current_tab_index`
4. **Estilos consistentes** - usa `STYLE_CONFIG`

---

## 📊 Comparativa: Antes vs Después

| Aspecto | Antes (Tabs Superior) | Ahora (Sidebar) |
|---------|----------------------|-----------------|
| **Orientación** | Horizontal | Vertical |
| **Espacio usado** | ~80px altura | 240px ancho |
| **Visibilidad** | Solo tab activo visible | Todas las opciones visibles |
| **Navegación** | Click en tab | Click en botón lateral |
| **Indicador activo** | Color de fondo tab | Barra lateral + color |
| **Hover effect** | Básico | Color de fondo completo |
| **Look & Feel** | Tradicional | Moderno/Empresarial |

---

## 🎯 Detalles de Implementación

### Estructura de Componentes
```
Sidebar (240px)
├── Borde derecho (2px primary)
├── Container interior
│   ├── Título "NAVEGACIÓN"
│   ├── Separador (3px primary)
│   ├── Botones de navegación
│   │   ├── Botón 1 (Producción)
│   │   │   ├── Indicador (4px)
│   │   │   └── Botón (texto + icono)
│   │   ├── Botón 2 (Empleados)
│   │   └── ... (6 botones total)
│   └── Footer
│       ├── Separador sutil
│       ├── Versión
│       └── Copyright
```

### Colores Utilizados
- **Fondo sidebar:** `#1e293b` (bg_darker)
- **Borde derecho:** `#6366f1` (primary_color)
- **Separador superior:** `#6366f1` (primary_color)
- **Botón activo:** `#6366f1` (primary_color)
- **Botón hover:** `#4f46e5` (primary_hover)
- **Indicador activo:** `#ec4899` (accent_color)
- **Texto footer:** `#94a3b8` (text_muted)

---

## 🚀 Uso del Sistema

### Para Navegar:
1. **Click** en cualquier botón del sidebar
2. La sección se activa **inmediatamente**
3. El botón cambia a color `primary_color`
4. Aparece el **indicador rosa** a la izquierda
5. El contenido cambia en el área principal

### Feedback Visual:
- **Hover:** Fondo azul claro al pasar el mouse
- **Activo:** Fondo azul + indicador rosa
- **Cursor:** Cambia a "mano" sobre los botones

---

## 💡 Personalización

Para modificar el sidebar, edita estas secciones en `app_rentabilidad.py`:

### Cambiar ancho del sidebar:
```python
self.sidebar = tk.Frame(main_container, bg=STYLE_CONFIG['bg_darker'], width=240)
# Cambia 240 por el ancho deseado
```

### Agregar nueva sección:
```python
tabs_info = [
    # ... secciones existentes ...
    ('Nueva Sección', '🆕', 6)  # Agregar al final
]
```

### Cambiar colores:
Modifica `STYLE_CONFIG` al inicio del archivo:
```python
'bg_darker': '#0f172a',  # Color del sidebar
'accent_color': '#ec4899',  # Color del indicador
```

---

## 📝 Notas Técnicas

1. **Notebook ocultado:** Las pestañas del `ttk.Notebook` están ocultas mediante estilos, pero siguen funcionando internamente.

2. **Propagación deshabilitada:** `pack_propagate(False)` mantiene el ancho fijo del sidebar.

3. **Diccionario de botones:** Cada botón se guarda con su indicador y container para fácil manipulación.

4. **Inicialización:** Los botones se crean automáticamente al final de `crear_widgets()`.

---

## 🎉 Resultado Final

Un sistema de navegación **profesional, moderno y intuitivo** que:
- ✅ Mejora la experiencia de usuario
- ✅ Da un aspecto empresarial premium
- ✅ Mantiene todas las funcionalidades
- ✅ Es fácil de usar y entender
- ✅ Se integra perfectamente con el diseño existente

---

**Sistema FABINSA CONTROL v2.0**  
*Navegación Lateral Profesional*


