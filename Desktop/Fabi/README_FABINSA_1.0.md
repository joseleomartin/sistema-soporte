# FABINSA CONTROL v1.0 - Sistema de Control de Rentabilidad

## Descripción
Sistema completo de control de rentabilidad para FABINSA que incluye gestión de productos, empleados, stock, costos y análisis financiero.

## Características Principales

### ✅ Gestión de Productos
- **Productos Fabricados**: Cálculo de costos de materia prima y mano de obra
- **Productos de Reventa**: Gestión de stock con precios en ARS y USD
- **Importación masiva**: Desde archivos Excel/CSV
- **Exportación completa**: Datos en formato Excel

### ✅ Gestión de Empleados
- Cálculo automático de costos de mano de obra
- Gestión de ausencias, vacaciones y licencias
- Cálculo de horas extras y feriados trabajados
- Actualización automática de costos en planilla

### ✅ Gestión de Stock
- **Materia Prima**: Control de stock con precios en USD/ARS
- **Productos Fabricados**: Seguimiento de producción
- **Productos de Reventa**: Con soporte multi-moneda
- Logs de movimientos automáticos

### ✅ Planilla de Costos
- Cálculo automático de costos totales
- Soporte para precios en USD y ARS
- Gestión de materiales manuales
- Cálculo de rentabilidad y márgenes
- Importación masiva de datos

### ✅ Compras
- **Materia Prima**: Registro de compras con moneda
- **Productos**: Compra de productos con selección ARS/USD
- Logs detallados de todas las operaciones

### ✅ Ventas
- Registro de ventas con descuentos
- Cálculo automático de ingresos netos
- Seguimiento de productos vendidos

### ✅ Análisis y Reportes
- Métricas de producción y ventas
- Análisis de rentabilidad por producto
- Exportación completa a Excel
- Gráficos de costos y márgenes

## Nuevas Características v1.0

### 🌟 Soporte Multi-Moneda Completo
- **Precios en USD**: Mantenidos sin conversión automática
- **Indicación visual**: "(USD)" al lado de precios en dólares
- **Persistencia**: Información de moneda guardada en data.json
- **Exportación**: Columnas separadas para moneda y precio con moneda

### 🌟 Campos Opcionales
- **Stock**: Medida y Característica opcionales
- **Productos de Reventa**: Medida y Característica opcionales
- **Valores por defecto**: "Sin Medida" y "Sin Característica"

### 🌟 Importación Robusta
- **Parser inteligente**: Maneja formatos complejos como "430 u$s 11.40"
- **Validación flexible**: Campos opcionales con valores por defecto
- **Manejo de errores**: Un solo mensaje al final de la importación
- **Reemplazo de duplicados**: Basado en Familia, Medida, Característica

### 🌟 Interfaz Mejorada
- **Layout responsivo**: Adaptado para diferentes resoluciones
- **Selección múltiple**: Para eliminación masiva en costos
- **IIBB global**: Doble-click para cambiar IIBB de todos los items
- **Validación mejorada**: Mensajes de error más claros

## Instalación y Uso

### Requisitos del Sistema
- Windows 10 o superior
- No requiere instalación de Python
- Ejecutable independiente

### Instrucciones de Uso

1. **Ejecutar**: Doble-click en `FABINSA_CONTROL_v1.0.exe`
2. **Primera vez**: El sistema creará automáticamente el archivo `data.json`
3. **Importar datos**: Usar botones de importación en cada pestaña
4. **Exportar**: Botón "📊 Exportar Excel" en la barra superior

### Archivos Importantes
- `data.json`: Base de datos de la aplicación
- `calculadora_rentabilidad.xlsx`: Archivo de exportación
- `plantilla_importacion_costos.xlsx`: Plantilla para importar costos

## Soporte Técnico

### Logs de Importación
- Se generan automáticamente con timestamp
- Formato: `importacion_costos_YYYYMMDD_HHMMSS.log`
- Incluyen detalles de errores y procesamiento

### Resolución de Problemas
- **Error de importación**: Revisar formato del archivo Excel
- **Datos no aparecen**: Verificar que se presionó "Actualizar Planilla"
- **Precios USD**: Verificar columna "Moneda_Precio" en archivo de importación

## Versión
**FABINSA CONTROL v1.0** - Diciembre 2024

## Contacto
Para soporte técnico o consultas sobre el sistema.







