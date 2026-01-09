# 🚀 Instrucciones de Inicio - Sistema de Extractores Bancarios

## ⚡ Inicio Rápido (Para usuarios)

### 1️⃣ Primera vez - Configuración Inicial

#### Windows:
```bash
# 1. Abrir PowerShell o CMD en la carpeta del proyecto
cd C:\Users\relim\Desktop\bolt\project

# 2. Iniciar el backend (esto instalará todo automáticamente)
cd backend
start.bat

# 3. Abrir OTRA terminal para el frontend
cd ..
npm run dev
```

#### Linux/Mac:
```bash
# 1. Abrir terminal en la carpeta del proyecto
cd /ruta/al/proyecto

# 2. Dar permisos de ejecución
chmod +x backend/start.sh

# 3. Iniciar el backend (esto instalará todo automáticamente)
cd backend
./start.sh

# 4. Abrir OTRA terminal para el frontend
cd ..
npm run dev
```

### 2️⃣ Siguientes veces - Inicio Normal

#### Windows:
```bash
# Terminal 1 - Backend
cd backend
start.bat

# Terminal 2 - Frontend
npm run dev
```

#### Linux/Mac:
```bash
# Terminal 1 - Backend
cd backend
./start.sh

# Terminal 2 - Frontend
npm run dev
```

### 3️⃣ Acceder a la Aplicación

1. Abre tu navegador en: **http://localhost:5173**
2. Inicia sesión con tus credenciales
3. Ve a **"Herramientas"** → **"Extractor de Tablas"**
4. ¡Listo para usar!

---

## 🔧 Requisitos del Sistema

### Para el Backend (Python):
- **Python 3.8+** → Descargar de [python.org](https://www.python.org/downloads/)
- **pip** (incluido con Python)

### Para el Frontend (Node.js):
- **Node.js 16+** → Descargar de [nodejs.org](https://nodejs.org/)
- **npm** (incluido con Node.js)

---

## 📦 ¿Qué hace el script de inicio?

El script `start.bat` / `start.sh` automáticamente:

1. ✅ Crea un entorno virtual de Python (si no existe)
2. ✅ Instala todas las dependencias necesarias
3. ✅ Verifica que todo esté correctamente configurado
4. ✅ Inicia el servidor backend en el puerto 5000

**No necesitas hacer nada manualmente** - el script se encarga de todo.

---

## 🐛 Solución de Problemas

### Error: "python no se reconoce como comando"

**Windows:**
1. Instala Python desde [python.org](https://www.python.org/downloads/)
2. Durante la instalación, marca la casilla **"Add Python to PATH"**
3. Reinicia la terminal

**Linux/Mac:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip python3-venv

# MacOS (con Homebrew)
brew install python@3
```

### Error: "npm no se reconoce como comando"

1. Instala Node.js desde [nodejs.org](https://nodejs.org/)
2. Reinicia la terminal
3. Verifica con: `node --version` y `npm --version`

### Error: "El puerto 5000 está en uso"

**Opción 1 - Cambiar el puerto:**
```python
# En backend/server.py, línea final:
app.run(host='0.0.0.0', port=5001, debug=True)  # Cambiar a 5001

# En frontend/src/components/Tools/TableExtractor.tsx:
const response = await fetch('http://localhost:5001/extract', {  // Cambiar a 5001
```

**Opción 2 - Cerrar el proceso que usa el puerto:**

**Windows:**
```bash
# Ver qué proceso usa el puerto 5000
netstat -ano | findstr :5000

# Cerrar el proceso (reemplaza PID con el número que viste)
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Ver qué proceso usa el puerto 5000
lsof -i :5000

# Cerrar el proceso
kill -9 <PID>
```

### Error: "ModuleNotFoundError: No module named 'flask'"

Esto significa que las dependencias no se instalaron correctamente.

**Solución:**
```bash
cd backend
# Activar entorno virtual
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Reinstalar dependencias
pip install -r requirements.txt
```

### Error: "Error de conexión" en el frontend

**Verificaciones:**
1. ¿Está el backend ejecutándose? Deberías ver una ventana de terminal con logs
2. ¿Dice "Running on http://0.0.0.0:5000"? Si no, revisa los errores
3. Abre en tu navegador: http://localhost:5000/health
   - Si ves `{"status": "ok"}`, el backend funciona
   - Si no carga, el backend tiene un problema

### Los archivos PDF no se procesan correctamente

**Verificaciones:**
1. ¿Seleccionaste el banco correcto?
2. ¿El PDF es del formato correcto del banco?
3. ¿El PDF no está protegido/encriptado?
4. Revisa la terminal del backend para ver mensajes de error específicos

---

## 🔄 Reinstalación Completa

Si todo falla, reinstala desde cero:

### Backend:
```bash
cd backend

# Eliminar entorno virtual
rm -rf venv  # Linux/Mac
rd /s /q venv  # Windows

# Volver a iniciar (el script lo configurará todo)
./start.sh  # Linux/Mac
start.bat  # Windows
```

### Frontend:
```bash
# Eliminar dependencias
rm -rf node_modules package-lock.json  # Linux/Mac
rd /s /q node_modules && del package-lock.json  # Windows

# Reinstalar
npm install
```

---

## 📁 Estructura del Proyecto

```
project/
├── backend/                    # Servidor Python
│   ├── start.bat              # Script de inicio Windows
│   ├── start.sh               # Script de inicio Linux/Mac
│   ├── server.py              # Servidor Flask
│   ├── check_setup.py         # Verificación de configuración
│   ├── requirements.txt       # Dependencias Python
│   ├── extractores/           # Scripts de extracción
│   │   ├── extractor_banco_galicia.py
│   │   ├── extractor_mercado_pago_directo.py
│   │   └── ... (17 extractores)
│   └── venv/                  # Entorno virtual (se crea automáticamente)
│
├── src/                       # Código fuente del frontend
│   └── components/
│       └── Tools/
│           ├── ToolsPanel.tsx
│           └── TableExtractor.tsx
│
├── GUIA_RAPIDA_EXTRACTORES.md
├── EXTRACTORES_README.md
└── INSTRUCCIONES_INICIO.md    # Este archivo
```

---

## 📞 Ayuda Adicional

### Verificar estado del backend:
```bash
cd backend
python check_setup.py
```

Este script te dirá exactamente qué está mal (si algo no funciona).

### Ver logs del backend:
Los logs aparecen en la terminal donde ejecutaste `start.bat` / `start.sh`

### Comandos útiles:

```bash
# Ver versión de Python
python --version

# Ver versión de Node.js
node --version

# Ver versión de npm
npm --version

# Ver dependencias Python instaladas
pip list

# Ver dependencias npm instaladas
npm list
```

---

## ✅ Lista de Verificación Pre-Inicio

Antes de reportar un problema, verifica:

- [ ] Python 3.8+ está instalado: `python --version`
- [ ] Node.js 16+ está instalado: `node --version`
- [ ] Las dependencias Python están instaladas: `cd backend && python check_setup.py`
- [ ] Las dependencias npm están instaladas: `npm list`
- [ ] El puerto 5000 está libre (no hay otro proceso usándolo)
- [ ] El puerto 5173 está libre (frontend de Vite)
- [ ] Tienes dos terminales abiertas (una para backend, otra para frontend)
- [ ] Ambas terminales están en la carpeta correcta del proyecto

---

## 🎉 ¡Todo Listo!

Si seguiste estos pasos, el sistema debería estar funcionando. Ahora puedes:

1. Cargar tus extractos bancarios en PDF
2. Seleccionar el banco correspondiente
3. Extraer los datos automáticamente
4. Descargar el Excel procesado

**¡Disfruta del sistema!** 🚀

---

**Última actualización:** 11 de Noviembre, 2025































