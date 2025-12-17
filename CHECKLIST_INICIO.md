# ✅ Checklist de Inicio Rápido

## 📋 Antes de Empezar

- [ ] Python 3.8+ instalado → `python --version`
- [ ] Node.js 16+ instalado → `node --version`
- [ ] Tienes los extractores en `backend/extractores/` (17 archivos .py)

## 🚀 Pasos de Inicio

### 1. Backend (Terminal 1)

- [ ] Abrir terminal en la carpeta `project`
- [ ] Ir a backend: `cd backend`
- [ ] Ejecutar:
  - **Windows:** `start.bat`
  - **Linux/Mac:** `chmod +x start.sh && ./start.sh`
- [ ] Esperar a ver: `Running on http://0.0.0.0:5000`
- [ ] **NO CERRAR ESTA TERMINAL**

### 2. Frontend (Terminal 2)

- [ ] Abrir OTRA terminal en la carpeta `project`
- [ ] Ejecutar: `npm run dev`
- [ ] Esperar a ver: `Local: http://localhost:5173`
- [ ] **NO CERRAR ESTA TERMINAL**

### 3. Navegador

- [ ] Abrir: `http://localhost:5173`
- [ ] Iniciar sesión
- [ ] Ir a: **Herramientas** (menú izquierdo)
- [ ] Click en: **Extractor de Tablas**

## 🎯 Primera Extracción

- [ ] Seleccionar un banco del dropdown
- [ ] Arrastrar un PDF o hacer clic para seleccionar
- [ ] Click en **"Extraer Datos"**
- [ ] Esperar el procesamiento
- [ ] Click en **"Descargar Excel"**
- [ ] ✅ **¡Listo!**

## 🔍 Verificación Rápida

Si algo no funciona, verifica:

- [ ] Backend está corriendo (Terminal 1 activa)
- [ ] Frontend está corriendo (Terminal 2 activa)
- [ ] Ambos muestran mensajes sin errores rojos
- [ ] Puedes abrir: http://localhost:5000/health
- [ ] El navegador muestra la aplicación

## 🆘 Si hay problemas

1. **Backend no inicia:**
   ```bash
   cd backend
   python check_setup.py
   ```
   Esto te dirá exactamente qué falta.

2. **"Error de conexión" en el frontend:**
   - Verifica que el backend esté corriendo
   - Abre http://localhost:5000/health en tu navegador
   - Debería mostrar: `{"status": "ok"}`

3. **"python no se reconoce":**
   - Instala Python desde python.org
   - Marca "Add Python to PATH" durante instalación

4. **"npm no se reconoce":**
   - Instala Node.js desde nodejs.org

## 📚 Documentación Completa

Para más detalles, consulta:

- `INSTRUCCIONES_INICIO.md` - Guía completa de inicio
- `GUIA_RAPIDA_EXTRACTORES.md` - Guía de uso
- `RESUMEN_EXTRACTORES.md` - Resumen técnico
- `backend/README.md` - Documentación del backend

## 🎉 ¡Éxito!

Si todos los checkboxes están marcados, ¡el sistema está funcionando!

**Siguiente paso:** Procesar tus extractos bancarios.

---

**Tiempo estimado de configuración:** 5-10 minutos (primera vez)
**Tiempo de inicio subsecuente:** 30 segundos






















