# FABINSA CONTROL v1.0 - Instrucciones de Distribución

## 📦 Contenido del Paquete

El archivo `FABINSA_CONTROL_v1.0.zip` contiene:

- **FABINSA_CONTROL_v1.0.exe** - Ejecutable principal del sistema
- **README_FABINSA_1.0.md** - Documentación completa del sistema
- **plantilla_importacion_costos.xlsx** - Plantilla para importar datos de costos
- **INSTRUCCIONES_IMPORTACION_COSTOS.md** - Guía detallada de importación

## 🚀 Instalación y Uso

### Requisitos del Sistema
- Windows 10 o superior
- No requiere instalación de Python ni dependencias adicionales
- Ejecutable independiente (portable)

### Instrucciones de Instalación

1. **Extraer archivos**: Descomprimir `FABINSA_CONTROL_v1.0.zip` en la carpeta deseada
2. **Ejecutar**: Doble-click en `FABINSA_CONTROL_v1.0.exe`
3. **Primera ejecución**: El sistema creará automáticamente el archivo `data.json`

## ✨ Nuevas Características v1.0

### 🌟 Soporte Multi-Moneda Completo
- **Precios en USD**: Se mantienen sin conversión automática
- **Indicación visual**: "(USD)" al lado de precios en dólares
- **Persistencia**: Información de moneda guardada correctamente
- **Exportación**: Columnas separadas para moneda y precio con moneda

### 🌟 Campos Opcionales
- **Stock**: Medida y Característica opcionales (valores por defecto: "Sin Medida", "Sin Característica")
- **Productos de Reventa**: Medida y Característica opcionales
- **Validación flexible**: Solo campos esenciales requeridos

### 🌟 Importación Robusta
- **Parser inteligente**: Maneja formatos complejos como "430 u$s 11.40", "7,2 USD", "1345,33 ARS"
- **Validación flexible**: Campos opcionales con valores por defecto
- **Manejo de errores**: Un solo mensaje al final de la importación
- **Reemplazo de duplicados**: Basado en Familia, Medida, Característica

### 🌟 Interfaz Mejorada
- **Layout responsivo**: Adaptado para diferentes resoluciones
- **Selección múltiple**: Para eliminación masiva en costos
- **IIBB global**: Doble-click en columna "IIBB %" para cambiar IIBB de todos los items
- **Validación mejorada**: Mensajes de error más claros

## 📋 Funcionalidades Principales

### ✅ Gestión de Productos
- **Productos Fabricados**: Cálculo automático de costos
- **Productos de Reventa**: Con soporte ARS/USD
- **Importación masiva**: Desde Excel/CSV
- **Exportación completa**: Datos en formato Excel

### ✅ Gestión de Empleados
- Cálculo automático de costos de mano de obra
- Gestión de ausencias, vacaciones y licencias
- Actualización automática de costos en planilla

### ✅ Gestión de Stock
- **Materia Prima**: Control con precios USD/ARS
- **Productos Fabricados**: Seguimiento de producción
- **Productos de Reventa**: Con soporte multi-moneda

### ✅ Planilla de Costos
- Cálculo automático de costos totales
- Soporte para precios en USD y ARS
- Gestión de materiales manuales
- Cálculo de rentabilidad y márgenes

### ✅ Compras
- **Materia Prima**: Registro con moneda
- **Productos**: Compra con selección ARS/USD
- Logs detallados de operaciones

## 📊 Importación de Datos

### Plantilla de Costos
Usar `plantilla_importacion_costos.xlsx` para importar datos masivamente:

**Columnas requeridas**:
- `Familia`, `Medida`, `Característica`
- `Precio_Venta`, `Moneda_Precio`
- `Cantidad_Fabricar`, `Cantidad_Hora`
- `IIBB_Porcentaje`, `Precio_Dolar`

**Formatos de precio soportados**:
- `430 u$s 11.40` → Detecta USD automáticamente
- `7,2 USD` → Precio en USD
- `1345,33 ARS` → Precio en ARS
- `1500` → Precio en ARS (por defecto)

### Proceso de Importación
1. **Preparar archivo**: Usar la plantilla proporcionada
2. **Importar**: Botón "📥 Importar Datos" en pestaña Costos
3. **Verificar**: Revisar tabla de costos actualizada
4. **Exportar**: Botón "📊 Exportar Excel" para respaldo

## 🔧 Resolución de Problemas

### Problemas Comunes

**Error de importación**:
- Verificar formato del archivo Excel
- Revisar que las columnas requeridas estén presentes
- Verificar formato de precios (usar comas para decimales)

**Datos no aparecen**:
- Presionar "🔄 Actualizar Planilla" después de importar
- Verificar que se completó la importación sin errores

**Precios USD no se muestran**:
- Verificar columna "Moneda_Precio" en archivo de importación
- Asegurar que contiene "USD" para productos en dólares

### Logs de Debugging
- Se generan automáticamente: `importacion_costos_YYYYMMDD_HHMMSS.log`
- Incluyen detalles de errores y procesamiento
- Revisar en caso de problemas de importación

## 📁 Archivos Importantes

- **data.json**: Base de datos de la aplicación (se crea automáticamente)
- **calculadora_rentabilidad.xlsx**: Archivo de exportación generado
- **plantilla_importacion_costos.xlsx**: Plantilla para importar costos

## 📞 Soporte Técnico

Para consultas o problemas técnicos:
- Revisar documentación en `README_FABINSA_1.0.md`
- Verificar logs de importación generados
- Contactar soporte técnico con detalles del problema

## 📝 Notas de Versión

**FABINSA CONTROL v1.0** - Diciembre 2024

### Cambios desde v0.9:
- ✅ Soporte completo multi-moneda (USD/ARS)
- ✅ Campos opcionales en Stock y Productos de Reventa
- ✅ Parser robusto para formatos de precio complejos
- ✅ Migración automática de productos existentes
- ✅ Exportación con información de moneda
- ✅ Interfaz mejorada y layout responsivo
- ✅ Validación más flexible y manejo de errores mejorado

---

**¡El sistema está listo para usar!** 🎉







