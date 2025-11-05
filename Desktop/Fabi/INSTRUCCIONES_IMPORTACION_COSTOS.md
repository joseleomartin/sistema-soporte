# Instrucciones de Importación de Datos - Planilla de Costos

## 📋 Descripción General

La funcionalidad de importación permite cargar automáticamente datos de productos y sus materiales asociados desde archivos Excel (.xlsx, .xls) o CSV (.csv) directamente a la planilla de costos.

## 🚀 Cómo Usar la Importación

### 1. **Preparar el Archivo de Datos**
- Descargar la plantilla: `plantilla_importacion_costos.xlsx`
- Completar los datos siguiendo la estructura indicada
- Guardar el archivo en formato Excel (.xlsx) o CSV (.csv)

### 2. **Importar los Datos**
1. Ir a la pestaña "💰 Costos"
2. Hacer clic en el botón "📥 Importar Datos"
3. Seleccionar el archivo preparado
4. El sistema procesará automáticamente todos los datos

## 📊 Estructura del Archivo

### **Columnas Obligatorias del Producto:**
- **Familia**: Nombre de la familia del producto
- **Medida**: Medida del producto (ej: "100x50", "200x100")
- **Característica**: Característica del producto (ej: "Estándar", "Premium")
- **Precio_Venta**: Precio de venta del producto
- **Moneda_Precio**: Moneda del precio ("ARS" o "USD")
- **Cantidad_Fabricar**: Cantidad a fabricar
- **Cantidad_Hora**: Cantidad por hora de producción
- **IIBB_Porcentaje**: Porcentaje de IIBB
- **Precio_Dolar**: Precio del dólar para conversiones

### **Columnas de Materiales (Opcionales):**
Para cada material, usar el formato: `Material_X_Campo`

- **Material_1_Nombre**: Nombre del primer material
- **Material_1_Cantidad**: Cantidad en kg del primer material
- **Material_1_Precio**: Precio del primer material
- **Material_1_Moneda**: Moneda del primer material ("ARS" o "USD")

- **Material_2_Nombre**: Nombre del segundo material
- **Material_2_Cantidad**: Cantidad en kg del segundo material
- **Material_2_Precio**: Precio del segundo material
- **Material_2_Moneda**: Moneda del segundo material ("ARS" o "USD")

Y así sucesivamente para más materiales...

## 💡 Ejemplos de Uso

### **Ejemplo 1: Producto con Materiales en Pesos**
```
Familia: "Ventanas"
Medida: "100x50"
Característica: "Estándar"
Precio_Venta: 15000
Moneda_Precio: "ARS"
Cantidad_Fabricar: 100
Cantidad_Hora: 10
IIBB_Porcentaje: 3.5
Precio_Dolar: 1200
Material_1_Nombre: "Acero"
Material_1_Cantidad: 2.5
Material_1_Precio: 800
Material_1_Moneda: "ARS"
```

### **Ejemplo 2: Producto con Materiales en Dólares**
```
Familia: "Puertas"
Medida: "200x100"
Característica: "Premium"
Precio_Venta: 25
Moneda_Precio: "USD"
Cantidad_Fabricar: 50
Cantidad_Hora: 8
IIBB_Porcentaje: 4.0
Precio_Dolar: 1200
Material_1_Nombre: "Aluminio"
Material_1_Cantidad: 1.8
Material_1_Precio: 15
Material_1_Moneda: "USD"
```

## ⚠️ Validaciones del Sistema

### **Validaciones Automáticas:**
1. **Columnas obligatorias**: El sistema verifica que existan todas las columnas requeridas
2. **Formato de moneda**: Solo acepta "ARS" o "USD"
3. **Valores numéricos**: Verifica que los precios y cantidades sean números válidos
4. **Conversión automática**: Los precios en USD se convierten automáticamente a pesos

### **Manejo de Errores:**
- Si una fila tiene errores, el sistema continúa con las siguientes filas
- Se muestra un mensaje con el número de items importados exitosamente
- Los errores específicos se reportan por fila

## 🔄 Proceso de Importación

1. **Selección de archivo**: El sistema abre un diálogo para seleccionar el archivo
2. **Validación de estructura**: Verifica que el archivo tenga las columnas correctas
3. **Procesamiento fila por fila**: Para cada fila:
   - Limpia el formulario
   - Carga los datos del producto
   - Procesa los materiales asociados
   - Convierte precios USD a pesos si es necesario
   - Agrega el item a la planilla de costos
4. **Confirmación**: Muestra el número de items importados exitosamente

## 📁 Archivos de Ejemplo

- **plantilla_importacion_costos.xlsx**: Plantilla con estructura y ejemplos
- **INSTRUCCIONES_IMPORTACION_COSTOS.md**: Este archivo de instrucciones

## 🆘 Solución de Problemas

### **Error: "Faltan las siguientes columnas"**
- Verificar que el archivo tenga todas las columnas obligatorias
- Revisar que los nombres de las columnas coincidan exactamente

### **Error: "Error procesando fila X"**
- Verificar que los valores numéricos sean válidos
- Asegurar que las monedas sean "ARS" o "USD"
- Revisar que no haya celdas vacías en campos obligatorios

### **Error: "Formato de archivo no soportado"**
- Usar archivos Excel (.xlsx, .xls) o CSV (.csv)
- Verificar que el archivo no esté corrupto

---
**Versión**: 0.9.0.0  
**Fecha**: Enero 2025  
**Desarrollado por**: FABINSA








