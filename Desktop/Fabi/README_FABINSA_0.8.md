# FABINSA CONTROL v0.8

## 🚀 Nuevas Funcionalidades

### Pestaña de Costos - Mejoras en Agregar Materiales

#### ✨ **Pop-up para Agregar Materiales Manualmente**
- **Nueva funcionalidad**: Al hacer clic en "➕ Agregar Material Manual" se abre un pop-up elegante
- **Campos disponibles**:
  - Nombre del Material
  - Cantidad por Unidad (Kg)
  - Precio por Kilo (en pesos)
- **Validaciones completas**: Verificación de campos obligatorios y valores numéricos
- **Interfaz intuitiva**: Botones "Guardar Material" y "Cancelar"

#### 🔄 **Interfaz Actualizada**
- **Botón principal**: Cambió de "➕ Agregar Item a Planilla" a "🔄 Actualizar Planilla"
- **Título del formulario**: Actualizado a "📝 Actualizar Planilla"
- **Tabla de materiales**: Encabezado "Costo/kg USD" cambiado a "Costo/kg"

#### 💰 **Sistema de Precios Mejorado**
- **Precios en pesos**: Los materiales agregados manualmente se ingresan directamente en pesos argentinos
- **Cálculo automático**: El sistema calcula automáticamente los costos totales usando los precios ingresados
- **Sin dependencia del stock**: Los materiales se agregan independientemente del stock existente

## 🛠️ Cambios Técnicos

### Funcionalidades Modificadas:
1. **`abrir_popup_agregar_material_costos()`**: Nueva función que crea el pop-up
2. **`agregar_material_costos()`**: Ahora abre el pop-up en lugar de usar combo del stock
3. **`actualizar_tabla_materiales_costos()`**: Actualizada para manejar precios manuales
4. **`_calcular_costo_materiales()`**: Modificada para usar precios manuales cuando están disponibles

### Mejoras en la Experiencia de Usuario:
- **Interfaz más clara**: Eliminación de referencias confusas a USD
- **Proceso simplificado**: Agregar materiales ahora es más directo e intuitivo
- **Validaciones mejoradas**: Mensajes de error más claros y específicos

## 📋 Instrucciones de Uso

### Para Agregar Materiales en Costos:
1. Ve a la pestaña "💰 Costos"
2. Completa los campos del formulario (Familia, Medida, Característica, etc.)
3. Haz clic en "➕ Agregar Material Manual"
4. En el pop-up que se abre:
   - Ingresa el nombre del material
   - Especifica la cantidad por unidad en kg
   - Ingresa el precio por kilo en pesos
   - Haz clic en "Guardar Material"
5. El material aparecerá en la tabla con el cálculo automático del costo total
6. Haz clic en "🔄 Actualizar Planilla" para agregar el item a la planilla de costos

## 🔧 Requisitos del Sistema
- Windows 10 o superior
- No requiere instalación adicional (ejecutable independiente)

## 📞 Soporte
Para consultas o reportar problemas, contactar al equipo de desarrollo de FABINSA.

---
**Versión**: 0.8.0.0  
**Fecha**: Enero 2025  
**Desarrollado por**: FABINSA











