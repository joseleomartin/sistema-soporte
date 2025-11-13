# 🔧 Solución Error 404 en Cloudflare Tunnel

## 🐛 Problema

El túnel de Cloudflare está funcionando, pero obtienes **404 Not Found** al acceder a los endpoints.

## ✅ Solución Paso a Paso

### PASO 1: Verificar que el Servidor Está Corriendo

**Abre una NUEVA ventana de CMD** y ejecuta:

```cmd
cd C:\Users\relim\Desktop\bolt\project\backend

REM Probar si el servidor responde localmente
curl http://localhost:5000/health
```

**Si obtienes un error de conexión**, significa que el servidor **NO está corriendo**.

**Solución**: 
1. Ve a la ventana donde ejecutaste `3-servidor-con-cloudflare.bat`
2. Verifica que el servidor Flask esté iniciado
3. Deberías ver líneas como:
   ```
   [INFO] SERVIDOR DE EXTRACTORES DE BANCOS - INICIANDO
   [INFO] Escuchando en http://0.0.0.0:5000
   ```

---

### PASO 2: Verificar que el Servidor Escucha en el Puerto Correcto

El servidor debe estar escuchando en **`0.0.0.0:5000`** o **`localhost:5000`**.

**Verifica en los logs del servidor** que veas:
```
Escuchando en http://0.0.0.0:5000
```

Si ves `127.0.0.1:5000` o solo `localhost:5000`, puede haber problemas.

---

### PASO 3: Reiniciar Todo Correctamente

**Cierra TODAS las ventanas de CMD** y vuelve a iniciar:

#### Opción A: Usar el Script (Recomendado)

1. **Termina todos los procesos**:
   - Presiona `Ctrl+C` en la ventana del túnel
   - Cierra todas las ventanas de CMD

2. **Inicia de nuevo**:
   - Doble click en `3-servidor-con-cloudflare.bat`
   - Espera a que aparezca la URL del túnel

#### Opción B: Manual (Más Control)

**Terminal 1 - Servidor**:
```cmd
cd C:\Users\relim\Desktop\bolt\project\backend

REM Activar venv si existe
if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat

set PORT=5000
python server.py
```

**Espera a ver**:
```
[INFO] Escuchando en http://0.0.0.0:5000
```

**Terminal 2 - Túnel**:
```cmd
cloudflared tunnel --url http://localhost:5000
```

---

### PASO 4: Verificar que el Túnel Apunta al Puerto Correcto

En los logs del túnel, verifica que diga:
```
url:http://localhost:5000
```

Si dice otro puerto (ej: `8080`), ese es el problema.

---

## 🔍 Diagnóstico Detallado

### Verificar Localmente Primero

**Antes de usar el túnel**, prueba localmente:

```cmd
REM Endpoint raíz
curl http://localhost:5000/

REM Health check
curl http://localhost:5000/health

REM Extractores
curl http://localhost:5000/extractors
```

**Si estos funcionan localmente pero NO a través del túnel**, el problema está en Cloudflare.

**Si NO funcionan ni localmente**, el problema está en el servidor Flask.

---

## 🎯 Soluciones Específicas

### Solución 1: El Servidor No Está Corriendo

**Síntomas**: 
- Error "connection refused" al hacer `curl http://localhost:5000/health`
- No ves logs del servidor Flask

**Solución**:
```cmd
cd C:\Users\relim\Desktop\bolt\project\backend
set PORT=5000
python server.py
```

Espera a ver: `Escuchando en http://0.0.0.0:5000`

---

### Solución 2: Puerto Incorrecto

**Síntomas**:
- El servidor está corriendo pero en otro puerto
- El túnel apunta a `5000` pero el servidor está en `8080`

**Solución**:
1. Verifica en qué puerto está el servidor (mira los logs)
2. Ajusta el túnel:
   ```cmd
   cloudflared tunnel --url http://localhost:PUERTO_CORRECTO
   ```

---

### Solución 3: Servidor Escucha Solo en 127.0.0.1

**Síntomas**:
- El servidor dice `Escuchando en http://127.0.0.1:5000`
- Cloudflare no puede conectarse

**Solución**: 
El servidor debe escuchar en `0.0.0.0:5000`. Verifica `server.py`:

```python
if __name__ == '__main__':
    host = os.environ.get('EXTRACTOR_HOST', '0.0.0.0')  # ← Debe ser 0.0.0.0
    port = int(os.environ.get('PORT', '5000'))
    app.run(host=host, port=port, debug=False)
```

---

### Solución 4: Firewall Bloqueando

**Síntomas**:
- Todo funciona localmente
- El túnel se crea pero da 404

**Solución**:
1. Abre Windows Defender Firewall
2. Permite Python a través del firewall
3. O temporalmente desactiva el firewall para probar

---

## ✅ Checklist de Verificación

Antes de usar el túnel, verifica:

- [ ] El servidor Flask está corriendo
- [ ] Ves logs del servidor (líneas con `[INFO]`)
- [ ] El servidor dice `Escuchando en http://0.0.0.0:5000`
- [ ] `curl http://localhost:5000/health` funciona localmente
- [ ] El túnel apunta a `http://localhost:5000`
- [ ] No hay errores en los logs del túnel

---

## 🚀 Proceso Correcto de Inicio

### Método Recomendado (2 Ventanas)

**Ventana 1 - Servidor**:
```cmd
cd C:\Users\relim\Desktop\bolt\project\backend
if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat
set PORT=5000
python server.py
```

**Espera a ver**:
```
[INFO] SERVIDOR DE EXTRACTORES DE BANCOS - INICIANDO
[INFO] Escuchando en http://0.0.0.0:5000
```

**Ventana 2 - Túnel**:
```cmd
cloudflared tunnel --url http://localhost:5000
```

**Espera a ver**:
```
Your quick Tunnel has been created! Visit it at:
https://xxxxx.trycloudflare.com
```

---

## 🧪 Probar la URL

Una vez que tengas la URL del túnel:

1. **Primero prueba localmente**:
   ```cmd
   curl http://localhost:5000/health
   ```

2. **Luego prueba la URL pública**:
   ```
   https://tu-url.trycloudflare.com/health
   ```

3. **Si local funciona pero público no**, el problema es el túnel
4. **Si ninguno funciona**, el problema es el servidor

---

## 📝 Logs a Revisar

### Logs del Servidor Flask (deben mostrar):
```
[INFO] SERVIDOR DE EXTRACTORES DE BANCOS - INICIANDO
[INFO] Flask app creada correctamente
[INFO] Extractores disponibles: 16
[INFO] Escuchando en http://0.0.0.0:5000
```

### Logs del Túnel (deben mostrar):
```
Your quick Tunnel has been created!
url:http://localhost:5000
Registered tunnel connection
```

---

## 🎯 Solución Rápida (Si Nada Funciona)

1. **Cierra TODO** (todas las ventanas CMD)

2. **Inicia el servidor SOLO**:
   ```cmd
   cd C:\Users\relim\Desktop\bolt\project\backend
   set PORT=5000
   python server.py
   ```

3. **En OTRA ventana, prueba local**:
   ```cmd
   curl http://localhost:5000/health
   ```

4. **Si funciona local, entonces inicia el túnel**:
   ```cmd
   cloudflared tunnel --url http://localhost:5000
   ```

---

¿Qué ves en los logs del servidor Flask? ¿Aparece "Escuchando en http://0.0.0.0:5000"? 🔍


