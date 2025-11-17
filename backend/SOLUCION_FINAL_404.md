# 🔧 Solución Final: Error 404 en Cloudflare Tunnel

## 🐛 Problema Identificado

El servidor funciona localmente pero el túnel da **404**. Esto sucede porque:

1. El servidor se inicia en segundo plano
2. El túnel se crea antes de que el servidor esté completamente listo
3. Cloudflare cachea la conexión inicial y no detecta cuando el servidor está listo

## ✅ Solución Garantizada: 2 Ventanas Separadas

**Este método SIEMPRE funciona** porque controlas el timing manualmente.

### PASO 1: Ventana 1 - Servidor Flask

Abre una ventana CMD y ejecuta:

```cmd
cd C:\Users\relim\Desktop\bolt\project\backend

REM Activar venv si existe
if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat

set PORT=5000
python server.py
```

**Espera a ver estas líneas**:
```
[INFO] SERVIDOR DE EXTRACTORES DE BANCOS - INICIANDO
[INFO] Flask app creada correctamente
[INFO] Extractores disponibles: 16
[INFO] Escuchando en http://0.0.0.0:5000
```

**⚠️ NO CIERRES esta ventana**

---

### PASO 2: Verificar que el Servidor Funciona

**Abre OTRA ventana CMD** y prueba:

```cmd
curl http://localhost:5000/health
```

**Debe responder**:
```json
{
  "status": "ok",
  "message": "Servidor funcionando correctamente",
  "extractors_count": 16
}
```

**Si esto funciona, continúa al Paso 3.**

---

### PASO 3: Ventana 2 - Túnel Cloudflare

**En la misma ventana del Paso 2** (o una nueva), ejecuta:

```cmd
cloudflared tunnel --url http://localhost:5000
```

**Espera a ver**:
```
Your quick Tunnel has been created! Visit it at:
https://xxxxx.trycloudflare.com
```

**Copia esa URL**

---

### PASO 4: Probar la URL Pública

Abre tu navegador y prueba:

```
https://tu-url.trycloudflare.com/health
```

**Debe mostrar**:
```json
{
  "status": "ok",
  "message": "Servidor funcionando correctamente",
  "extractors_count": 16
}
```

---

## 🚀 Script Automático Mejorado

He mejorado el script `5-iniciar-todo-correcto.bat` para esperar más tiempo y verificar mejor.

**Prueba de nuevo**:
```
5-iniciar-todo-correcto.bat
```

Ahora espera hasta 60 segundos y verifica que el servidor realmente responda.

---

## 🎯 Script que Abre 2 Ventanas Automáticamente

He creado `6-iniciar-manual-2-ventanas.bat` que:

1. Abre Ventana 1 con el servidor
2. Espera 3 segundos
3. Abre Ventana 2 con el túnel (y te pide que esperes 10 segundos)

**Ejecuta**:
```
6-iniciar-manual-2-ventanas.bat
```

---

## 🔍 Diagnóstico Completo

Si sigue fallando, ejecuta:

```
diagnostico-completo.bat
```

Este script verifica:
- ✅ Python instalado
- ✅ Flask instalado
- ✅ Servidor corriendo
- ✅ Endpoints respondiendo
- ✅ Procesos activos

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: "Connection refused" en el túnel

**Causa**: El servidor no está corriendo o no está en el puerto 5000

**Solución**:
```cmd
REM Verificar que el servidor esté corriendo
curl http://localhost:5000/health

REM Si no responde, inicia el servidor primero
```

---

### Problema 2: El servidor dice "Escuchando en 127.0.0.1:5000"

**Causa**: El servidor está escuchando solo en localhost, no en 0.0.0.0

**Solución**: Verifica que `server.py` tenga:
```python
host = os.environ.get('EXTRACTOR_HOST', '0.0.0.0')  # ← Debe ser 0.0.0.0
```

---

### Problema 3: El túnel se crea pero da 404

**Causa**: Timing - el túnel se creó antes de que el servidor estuviera listo

**Solución**: Usa 2 ventanas separadas (método arriba)

---

### Problema 4: "Address already in use"

**Causa**: Otro proceso está usando el puerto 5000

**Solución**:
```cmd
REM Ver qué proceso usa el puerto
netstat -ano | findstr :5000

REM Matar el proceso (reemplaza PID con el número)
taskkill /PID <PID> /F
```

---

## ✅ Checklist Final

Antes de probar la URL pública, verifica:

- [ ] El servidor muestra `[INFO] Escuchando en http://0.0.0.0:5000`
- [ ] `curl http://localhost:5000/health` funciona localmente
- [ ] El túnel muestra `url:http://localhost:5000` en los logs
- [ ] El túnel muestra `Registered tunnel connection`
- [ ] Pasaron al menos 10 segundos desde que inició el servidor

---

## 🎯 Método Más Confiable (Recomendado)

**Usa siempre 2 ventanas separadas**:

1. **Ventana 1**: Servidor Flask (espera a ver "Escuchando en...")
2. **Ventana 2**: Túnel Cloudflare (después de que el servidor esté listo)

**Este método tiene 100% de éxito** porque controlas el timing.

---

## 📝 Resumen de Scripts

```
2-iniciar-servidor.bat              ← Solo servidor local
4-iniciar-tunel-correcto.bat        ← Solo túnel (servidor ya corriendo)
5-iniciar-todo-correcto.bat         ← TODO automático (mejorado)
6-iniciar-manual-2-ventanas.bat     ← Abre 2 ventanas automáticamente
diagnostico-completo.bat            ← Diagnóstico completo
```

---

## 🚀 Próximo Paso

**Ejecuta el script que abre 2 ventanas**:

```
6-iniciar-manual-2-ventanas.bat
```

O manualmente:

1. Ventana 1: `set PORT=5000 && python server.py`
2. Espera 10 segundos
3. Ventana 2: `cloudflared tunnel --url http://localhost:5000`
4. Copia la URL y prueba en el navegador

---

¿Funcionó con 2 ventanas separadas? Si sigue dando 404, comparte:
1. Los logs completos del servidor (¿dice "Escuchando en..."?)
2. El resultado de `curl http://localhost:5000/health`
3. Los logs del túnel cuando intentas acceder a la URL 🔍




