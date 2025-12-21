# 📋 Guía Rápida: Extractor de Extractos Bancarios

## 🚀 Inicio Rápido (3 pasos)

### Paso 1: Iniciar el Backend
Abre una terminal en la carpeta `backend` y ejecuta:

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

Espera a que veas el mensaje: `Running on http://0.0.0.0:5000`

### Paso 2: Iniciar la Aplicación Web
Abre otra terminal en la carpeta `project` y ejecuta:

```bash
npm run dev
```

Abre tu navegador en: `http://localhost:5173`

### Paso 3: Usar el Extractor
1. Inicia sesión en la aplicación
2. Ve a **"Herramientas"** en el menú izquierdo
3. Haz clic en **"Extractor de Tablas"**
4. Selecciona tu banco
5. Arrastra tu PDF o haz clic para seleccionarlo
6. Presiona **"Extraer Datos"**
7. ¡Descarga tu Excel!

## 🏦 Bancos Disponibles

| Banco | Estado |
|-------|--------|
| Banco Galicia | ✅ |
| Banco Galicia Más | ✅ |
| Mercado Pago | ✅ |
| Banco Comafi | ✅ |
| Banco JP Morgan | ✅ |
| Banco BIND | ✅ |
| Banco Supervielle | ✅ |
| Banco Cabal | ✅ |
| Banco Credicoop | ✅ |
| Banco CMF | ✅ |
| Banco Santander | ✅ |
| Banco del Sol | ✅ |
| Banco Ciudad | ✅ |
| Banco BBVA | ✅ |
| Banco ICBC | ✅ |
| Banco Macro | ✅ |
| Banco Nación | ✅ |

## ❓ Problemas Comunes

### "Error de conexión"
**Solución:** Asegúrate de que el backend esté ejecutándose. Deberías ver una ventana de terminal activa con logs del servidor.

### "Banco no soportado"
**Solución:** Verifica que hayas seleccionado un banco de la lista antes de cargar el PDF.

### "Error al procesar el archivo"
**Soluciones:**
- Verifica que el PDF sea del banco correcto
- Asegúrate de que el PDF no esté dañado
- Intenta con otro extracto del mismo banco

### El backend no inicia
**Soluciones:**
- Verifica que Python esté instalado: `python --version`
- Reinstala las dependencias: 
  ```bash
  cd backend
  pip install -r requirements.txt
  ```

## 📊 ¿Qué hace el Extractor?

El extractor analiza tu PDF bancario y:
- ✅ Identifica todas las transacciones
- ✅ Extrae fechas, conceptos, débitos y créditos
- ✅ Calcula saldos
- ✅ Genera un Excel organizado y listo para usar

## 🔒 Seguridad

- ✅ Todos los archivos se procesan localmente
- ✅ Los PDFs se eliminan automáticamente después del procesamiento
- ✅ Los archivos Excel se almacenan temporalmente
- ✅ No se envía información a servidores externos

## 💡 Consejos

1. **Formato del PDF:** Usa PDFs originales descargados del banco, no escaneados
2. **Nombre claro:** Nombra tus PDFs de forma descriptiva (ej: "Galicia_Enero_2025.pdf")
3. **Un banco a la vez:** Selecciona el banco correcto antes de cargar el PDF
4. **Revisa el Excel:** Siempre verifica los datos extraídos por posibles errores

## 🛠️ Reinstalación Completa (Si algo falla)

### Backend:
```bash
cd backend
# Eliminar entorno virtual
rm -rf venv  # (Linux/Mac) o rd /s venv (Windows)

# Crear nuevo entorno
python -m venv venv

# Activar
source venv/bin/activate  # (Linux/Mac) o venv\Scripts\activate (Windows)

# Instalar dependencias
pip install -r requirements.txt
```

### Frontend:
```bash
cd project
# Eliminar node_modules
rm -rf node_modules  # (Linux/Mac) o rd /s node_modules (Windows)

# Reinstalar
npm install
```

## 📞 Soporte

Si ninguna de estas soluciones funciona, contacta al equipo de soporte con:
- Captura de pantalla del error
- Nombre del banco
- Mensaje de error completo de la consola

---

**¡Listo! Ya puedes procesar tus extractos bancarios en segundos.**

























