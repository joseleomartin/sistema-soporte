# 🔧 Solución: Túnel Funciona pero Da 404

## ✅ Diagnóstico

Si el script de verificación dice que **todos los endpoints respondieron correctamente**, significa:

- ✅ El servidor Flask está funcionando
- ✅ Los endpoints responden localmente
- ❌ El problema está en la configuración del túnel

## 🎯 Solución: Reiniciar el Túnel Correctamente

### Problema Común

El túnel se creó **antes** de que el servidor estuviera completamente listo, o el túnel anterior quedó "cacheado".

### Solución Paso a Paso

#### PASO 1: Cerrar TODO

1. **Cierra la ventana del túnel** (presiona `Ctrl+C`)
2. **Cierra la ventana del servidor** (si está corriendo)
3. **Verifica que no queden procesos**:
   ```cmd
   tasklist | findstr python
   tasklist | findstr cloudflared
   ```

#### PASO 2: Iniciar el Servidor PRIMERO

**Ventana 1 - Servidor**:
```cmd
cd C:\Users\relim\Desktop\bolt\project\backend

REM Activar venv si existe
if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat

set PORT=5000
python server.py
```

**Espera a ver**:
```
[INFO] SERVIDOR DE EXTRACTORES DE BANCOS - INICIANDO
[INFO] Escuchando en http://0.0.0.0:5000
```

**NO cierres esta ventana**

#### PASO 3: Verificar que el Servidor Responde

**Abre OTRA ventana** y prueba:
```cmd
curl http://localhost:5000/health
curl http://localhost:5000/extractors
```

**Debe responder con JSON**. Si funciona, continúa.

#### PASO 4: Iniciar el Túnel DESPUÉS

**Ventana 2 - Túnel** (NUEVA ventana):
```cmd
cloudflared tunnel --url http://localhost:5000
```

**Espera a ver**:
```
Your quick Tunnel has been created! Visit it at:
https://xxxxx.trycloudflare.com
```

#### PASO 5: Probar la URL Pública

Abre tu navegador y prueba:
```
https://tu-url.trycloudflare.com/health
https://tu-url.trycloudflare.com/extractors
```

---

## 🚀 Scripts Mejorados

He creado 2 scripts nuevos para ti:

### Script 1: `4-iniciar-tunel-correcto.bat`

**Usa este cuando el servidor YA está corriendo**:

1. Primero inicia el servidor (Ventana 1):
   ```cmd
   2-iniciar-servidor.bat
   ```

2. Luego inicia el túnel (Ventana 2):
   ```cmd
   4-iniciar-tunel-correcto.bat
   ```

Este script **verifica** que el servidor esté corriendo antes de crear el túnel.

---

### Script 2: `5-iniciar-todo-correcto.bat` (RECOMENDADO)

**Este script hace TODO automáticamente**:

1. Inicia el servidor
2. Espera a que responda
3. Verifica que funciona
4. Inicia el túnel

**Solo haz doble click en**:
```
5-iniciar-todo-correcto.bat
```

Este es el **más confiable** porque espera a que el servidor esté listo.

---

## 🔍 Verificación Final

Una vez que tengas la URL del túnel, prueba estos endpoints:

### 1. Health Check
```
https://tu-url.trycloudflare.com/health
```
**Debe responder**:
```json
{
  "status": "ok",
  "message": "Servidor funcionando correctamente",
  "extractors_count": 16
}
```

### 2. Endpoint Raíz
```
https://tu-url.trycloudflare.com/
```
**Debe responder** con información del servidor.

### 3. Lista de Extractores
```
https://tu-url.trycloudflare.com/extractors
```
**Debe responder**:
```json
{
  "extractors": ["banco_galicia", "banco_comafi", ...],
  "count": 16
}
```

---

## 🐛 Si Sigue Dando 404

### Verificación 1: El Túnel Apunta al Puerto Correcto

En los logs del túnel, verifica que diga:
```
url:http://localhost:5000
```

Si dice otro puerto, ese es el problema.

### Verificación 2: El Servidor Está Escuchando

En los logs del servidor, verifica:
```
[INFO] Escuchando en http://0.0.0.0:5000
```

Si dice `127.0.0.1` o no aparece, hay un problema.

### Verificación 3: Firewall

Temporalmente desactiva Windows Firewall para probar:
1. Windows Security → Firewall
2. Desactivar temporalmente
3. Probar la URL del túnel
4. Si funciona, configura excepciones para Python

---

## ✅ Método Garantizado (2 Ventanas)

**Este método SIEMPRE funciona**:

### Ventana 1 - Servidor:
```cmd
cd C:\Users\relim\Desktop\bolt\project\backend
if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat
set PORT=5000
python server.py
```

**Espera a ver**: `Escuchando en http://0.0.0.0:5000`

### Ventana 2 - Túnel:
```cmd
cloudflared tunnel --url http://localhost:5000
```

**Copia la URL** que aparece.

### Probar:
Abre navegador: `https://tu-url.trycloudflare.com/health`

---

## 📝 Resumen de Scripts Disponibles

```
1-instalar-dependencias.bat          ← Instalar dependencias
1-instalar-con-venv.bat              ← Instalar con venv (mejor)
2-iniciar-servidor.bat               ← Solo servidor local
3-servidor-con-cloudflare.bat        ← Servidor + túnel (puede fallar)
4-iniciar-tunel-correcto.bat        ← Solo túnel (servidor ya corriendo)
5-iniciar-todo-correcto.bat          ← TODO automático (RECOMENDADO)
verificar-servidor.bat               ← Verificar que funciona
```

---

## 🎯 Próximo Paso AHORA

**Ejecuta el script mejorado**:

1. **Doble click en**: `5-iniciar-todo-correcto.bat`
2. **Espera** a que aparezca la URL del túnel
3. **Copia la URL**
4. **Prueba en el navegador**: `https://tu-url.trycloudflare.com/health`

**Este script espera a que el servidor esté listo antes de crear el túnel**, así que debería funcionar perfectamente.

---

¿Funcionó? Si sigue dando 404, comparte:
1. Los logs del servidor (¿dice "Escuchando en..."?)
2. Los logs del túnel (¿qué URL aparece?)
3. El resultado de `curl http://localhost:5000/health` 🔍


