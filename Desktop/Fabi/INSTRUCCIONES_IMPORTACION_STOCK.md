# 📋 Instrucciones de Importación de Stock

## 🎯 Nuevo Sistema Unificado

A partir de ahora, **puedes usar UN SOLO archivo Excel** para importar tanto **Materia Prima** como **Productos de Reventa**.

---

## 📁 Estructura del Archivo Excel

El archivo Excel debe contener **2 hojas** con nombres específicos:

### 📄 Hoja 1: "Materia Prima"
Columnas disponibles (flexible):
- **Familia** - Categoría del material
- **Medida** - Especificación de medida (ej: 1000 kg)
- **Característica** - Descripción adicional (ej: Alta densidad)
- **Stock (kg)** - Cantidad en kilogramos *(requerido)*
- **Costo/kg USD** - Precio por kilogramo en USD
- **Valor dólar** - Tipo de cambio
- **Stock Mínimo** - Cantidad mínima de stock

### 📄 Hoja 2: "Productos Reventa"
Columnas disponibles (flexible):
- **Familia** - Categoría del producto
- **Medida** - Especificación de medida (ej: M8)
- **Característica** - Descripción adicional (ej: Acero inoxidable)
- **Stock** - Cantidad en unidades *(requerido)*
- **Costo Unitario** - Precio por unidad *(en la moneda especificada)*
- **Costo Total** - Costo total de la compra *(en la moneda especificada)*
- **Moneda** - Moneda del costo *(ARS o USD)*
- **Valor dólar** - Tipo de cambio *(obligatorio cuando Moneda = USD)*

---

## 🚀 Cómo Usar

### Paso 1: Exportar Plantilla
1. Abre la aplicación FABINSA CONTROL
2. Ve a la pestaña **Stock**
3. En cualquiera de las dos sub-pestañas (Materia Prima o Productos Reventa), busca el botón **"📋 Exportar Plantilla"**
4. Guarda el archivo con el nombre que prefieras (ej: `stock_fabinsa.xlsx`)

### Paso 2: Editar el Archivo
1. Abre el archivo Excel generado
2. Verás **2 hojas**:
   - **"Materia Prima"** - Edita con tus materias primas
   - **"Productos Reventa"** - Edita con tus productos de reventa
3. **IMPORTANTE:** Mantén los nombres de las hojas exactamente como están
4. Elimina las filas de ejemplo y agrega tus datos
5. Guarda el archivo

### Paso 3: Importar los Datos
Tienes dos opciones:

#### Opción A: Importar Ambas Hojas (Recomendado)
1. Ve a la pestaña **Stock → Materia Prima**
2. Haz clic en **"📥 Importar Materia Prima"**
3. Selecciona tu archivo Excel
4. El sistema importará automáticamente la hoja "Materia Prima"
5. Luego ve a **Stock → Productos Reventa**
6. Haz clic en **"📥 Importar Stock"**
7. Selecciona el **MISMO archivo Excel**
8. El sistema importará automáticamente la hoja "Productos Reventa"

#### Opción B: Importar Solo Una Hoja
- Si solo tienes datos en una hoja, simplemente usa el botón de importación correspondiente
- El sistema detectará automáticamente la hoja correcta

### ✅ ¿Qué se Importa Correctamente?

**Para Materia Prima:**
- ✅ Stock en kilogramos
- ✅ Costos por kilogramo en USD
- ✅ Valor del dólar
- ✅ Stock mínimo
- ✅ Nombres combinados automáticamente

**Para Productos de Reventa:**
- ✅ Stock en unidades
- ✅ Costos unitarios (en la moneda especificada)
- ✅ Costos totales (en la moneda especificada)
- ✅ Moneda (ARS/USD) - **DETECCIÓN AUTOMÁTICA**
- ✅ Valor del dólar - **OBLIGATORIO para USD**
- ✅ Conversión automática a ARS para cálculos
- ✅ Nombres combinados automáticamente

### 💰 Manejo Inteligente de Monedas

**Ejemplo 1: Producto en ARS**
- Moneda: "ARS"
- Costo Unitario: 50.0 (pesos)
- Valor dólar: 1000 (ignorado para ARS)
- **Resultado:** Se mantiene en ARS

**Ejemplo 2: Producto en USD**
- Moneda: "USD"  
- Costo Unitario: 25.0 (dólares)
- Valor dólar: 1000 (pesos por dólar)
- **Resultado:** Se convierte a 25,000 ARS automáticamente

---

## ⚙️ Características Avanzadas

### 💰 Manejo Inteligente de Monedas

El sistema detecta automáticamente la moneda y maneja las conversiones:

**Para productos en ARS:**
- Especifica `Moneda: "ARS"`
- Los costos se mantienen en pesos argentinos
- El valor del dólar se ignora

**Para productos en USD:**
- Especifica `Moneda: "USD"`
- Los costos deben estar en dólares
- **OBLIGATORIO:** Especificar el `Valor dólar` (pesos por dólar)
- El sistema convierte automáticamente a ARS para cálculos

**Ejemplos en la plantilla:**
- Tornillos: ARS 50.00 por unidad
- Válvulas: USD 25.00 por unidad (se convierte a ARS 25,000.00)

### Detección Automática de Columnas
El sistema es **muy flexible** y puede detectar las columnas aunque tengan nombres ligeramente diferentes:
- "Stock (kg)" = "stock" = "Stock" = "Cantidad" = "Kg"
- "Familia" = "familia" = "Categoría" = "categoria"
- "Medida" = "medida" = "Tamaño" = "tamaño"

### Formato de Nombre Automático
Si proporcionas las columnas **Familia**, **Medida** y **Característica** por separado, el sistema creará automáticamente el nombre completo:

**Ejemplo:**
- Familia: "Polietileno"
- Medida: "1000 kg"
- Característica: "Alta densidad"
- **Resultado:** "Polietileno - 1000 kg - Alta densidad"

### Actualización vs Agregado
- Si un producto/material **ya existe** (mismo nombre), se **actualizará** su stock
- Si es nuevo, se **agregará** a la lista

---

## ⚠️ Notas Importantes

1. **Nombres de Hojas**: Deben ser exactamente "Materia Prima" y "Productos Reventa"
2. **Números Decimales**: Usa punto (.) no coma (,) para decimales (ej: 1.5 no 1,5)
3. **Stock Cero**: Las filas con stock 0 o vacío serán ignoradas
4. **Columnas Opcionales**: Puedes omitir columnas opcionales, el sistema las manejará
5. **Orden de Columnas**: No importa el orden de las columnas en el Excel

---

## 🎨 Consejos

- **Mantén un solo archivo Excel** con ambas hojas para facilitar la gestión
- **Usa la plantilla exportada** como referencia para el formato correcto
- **Haz backup** de tus datos antes de importaciones masivas
- **Revisa los mensajes** del sistema después de importar para ver el resumen

---

## 📞 Soporte

Si tienes problemas con la importación:
1. Verifica que los nombres de las hojas sean correctos
2. Asegúrate de tener al menos la columna de Stock
3. Revisa que los números estén en formato correcto (sin símbolos especiales)
4. Consulta los ejemplos en la plantilla exportada

---

**¡Listo para usar! 🎉**

