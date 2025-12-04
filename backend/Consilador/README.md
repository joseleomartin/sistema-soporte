# Comparador de Archivos Excel

Programa en Python para comparar dos archivos Excel y encontrar elementos faltantes en ambos lados, además de generar una hoja con todos los datos unificados.

## Características

- ✅ Compara dos archivos Excel (.xls o .xlsx)
- ✅ Identifica elementos faltantes en cada archivo
- ✅ Genera un archivo Excel con tres hojas:
  1. **Faltantes en Archivo 1**: Registros que están en el archivo 2 pero no en el archivo 1
  2. **Faltantes en Archivo 2**: Registros que están en el archivo 1 pero no en el archivo 2
  3. **Todos Unificados**: Todos los registros únicos de ambos archivos combinados

## Requisitos

Instala las dependencias necesarias:

```bash
pip install -r requirements.txt
```

O manualmente:

```bash
pip install pandas openpyxl xlrd
```

## Uso

### Opción 1: Comparación Automática

Si tienes exactamente 2 archivos Excel en el directorio actual, simplemente ejecuta:

```bash
python comparar_robusto.py
```

El programa buscará automáticamente los archivos Excel y los comparará.

### Opción 2: Especificar Archivos Manualmente

```bash
python comparar_robusto.py archivo1.xlsx archivo2.xlsx
```

### Opción 3: Versión Completa con Opciones

```bash
python comparar_excel.py archivo1.xlsx archivo2.xlsx [columna_clave] [archivo_salida.xlsx]
```

Ejemplos:
```bash
# Comparación básica
python comparar_excel.py datos1.xlsx datos2.xlsx

# Especificar columna clave para comparar
python comparar_excel.py datos1.xlsx datos2.xlsx "CUIT Agente Ret./Perc."

# Especificar columna clave y nombre de archivo de salida
python comparar_excel.py datos1.xlsx datos2.xlsx "CUIT Agente Ret./Perc." resultado.xlsx
```

## Cómo Funciona

1. El programa lee ambos archivos Excel
2. Usa la **primera columna** como clave de comparación (o la que especifiques)
3. Compara los valores únicos de esa columna entre ambos archivos
4. Identifica qué registros faltan en cada lado
5. Genera un archivo `resultado_comparacion.xlsx` con tres hojas

## Solución de Problemas

### Archivo Corrupto

Si recibes un error indicando que un archivo está corrupto:

1. Abre el archivo en Microsoft Excel
2. Guarda el archivo de nuevo (puedes guardarlo como .xlsx)
3. Intenta ejecutar el programa nuevamente

### Columna Clave Incorrecta

Si la primera columna no es la adecuada para comparar:

- Usa la versión completa del programa especificando la columna:
  ```bash
  python comparar_excel.py archivo1.xlsx archivo2.xlsx "Nombre de Columna"
  ```

### Archivos con Diferentes Columnas

El programa puede comparar archivos con diferentes columnas. Solo necesita que la columna clave exista en ambos archivos.

## Archivos del Proyecto

- `comparar_robusto.py` - Versión recomendada, más robusta y fácil de usar
- `comparar_automatico.py` - Versión simplificada para uso automático
- `comparar_excel.py` - Versión completa con todas las opciones
- `requirements.txt` - Dependencias del proyecto

## Ejemplo de Salida

El programa generará un archivo `resultado_comparacion.xlsx` con:

- **Hoja 1**: Registros que están en el archivo 2 pero no en el archivo 1
- **Hoja 2**: Registros que están en el archivo 1 pero no en el archivo 2  
- **Hoja 3**: Todos los registros únicos de ambos archivos

## Notas

- El programa elimina duplicados basándose en la columna clave
- Los valores vacíos o "nan" se ignoran en la comparación
- La comparación es sensible a mayúsculas/minúsculas, pero se eliminan espacios en blanco

