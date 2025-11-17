# 🚀 Guía Completa: Usar ngrok para Exponer tu Servidor

## ✅ Ventajas de ngrok vs Cloudflare Tunnel

| Característica | ngrok | Cloudflare Tunnel |
|----------------|-------|-------------------|
| **Facilidad** | ⭐⭐⭐⭐⭐ Muy fácil | ⭐⭐⭐⭐ Fácil |
| **Estabilidad** | ⭐⭐⭐⭐⭐ Muy estable | ⭐⭐⭐⭐ Estable |
| **Dashboard Web** | ✅ Sí (muy útil) | ❌ No |
| **URL Gratis** | ⚠️ Cambia cada vez | ⚠️ Cambia cada vez |
| **URL Fija** | 💰 $8/mes | ✅ Gratis (túnel permanente) |
| **Configuración** | ⭐⭐⭐⭐⭐ Muy simple | ⭐⭐⭐ Media |

**Conclusión**: ngrok es **más fácil y estable** para empezar rápidamente.

---

## 📦 Instalación de ngrok

### Opción 1: Con winget (Recomendado)

```cmd
winget install ngrok
```

### Opción 2: Con Chocolatey

```cmd
choco install ngrok
```

### Opción 3: Descarga Manual

1. Ve a: https://ngrok.com/download
2. Descarga: `ngrok-windows-amd64.zip`
3. Extrae `ngrok.exe`
4. Copia a `C:\Windows\System32` (o agrega al PATH)

### Opción 4: Script Automático

**Doble click en**:
```
instalar-ngrok.bat
```

---

## 🔐 Configuración Inicial (Solo Primera Vez)

### Paso 1: Crear Cuenta Gratis

1. Ve a: https://ngrok.com/signup
2. Crea una cuenta (gratis)
3. Verifica tu email

### Paso 2: Obtener Authtoken

1. Ve a: https://dashboard.ngrok.com/get-started/your-authtoken
2. Copia tu authtoken (se ve así: `ngrok_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### Paso 3: Configurar ngrok

```cmd
ngrok config add-authtoken TU_TOKEN_AQUI
```

**O usa el script**:
```
configurar-ngrok.bat
```

---

## 🚀 Uso Básico

### Método 1: Script Automático (Recomendado)

**Doble click en**:
```
8-iniciar-todo-ngrok.bat
```

Este script:
- ✅ Inicia el servidor Flask
- ✅ Espera a que esté listo
- ✅ Inicia ngrok
- ✅ Te muestra la URL pública

---

### Método 2: Manual (2 Ventanas)

#### Ventana 1 - Servidor:

```cmd
cd C:\Users\relim\Desktop\bolt\project\backend
set PORT=5000
python server.py
```

**Espera a ver**: `[INFO] Escuchando en http://0.0.0.0:5000`

#### Ventana 2 - ngrok:

```cmd
ngrok http 5000
```

**Verás**:
```
Session Status                online
Account                       Tu Cuenta
Forwarding                    https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:5000
```

**Copia la URL**: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`

---

### Método 3: Solo ngrok (Servidor Ya Corriendo)

Si el servidor ya está corriendo:

**Doble click en**:
```
7-iniciar-con-ngrok.bat
```

---

## 🌐 Dashboard Web de ngrok

Una de las mejores características de ngrok es su **dashboard web**:

1. Ve a: http://localhost:4040 (se abre automáticamente)
2. O manualmente: https://dashboard.ngrok.com/

**En el dashboard puedes ver**:
- ✅ Todas las requests en tiempo real
- ✅ Headers y body de cada request
- ✅ Respuestas del servidor
- ✅ Estadísticas de uso
- ✅ Replay requests (repetir requests)

**¡Muy útil para debugging!**

---

## 🎯 Probar la URL Pública

Una vez que tengas la URL de ngrok:

### Health Check:
```
https://tu-url.ngrok-free.app/health
```

**Debe mostrar**:
```json
{
  "status": "ok",
  "message": "Servidor funcionando correctamente",
  "extractors_count": 17
}
```

### Lista de Extractores:
```
https://tu-url.ngrok-free.app/extractors
```

---

## 🔧 Opciones Avanzadas de ngrok

### URL Personalizada (Solo Plan Pro)

```cmd
ngrok http 5000 --domain=tu-dominio.ngrok-free.app
```

**Costo**: $8/mes

---

### Subdominio Personalizado (Plan Pro)

```cmd
ngrok http 5000 --subdomain=extractores
```

**URL será**: `https://extractores.ngrok-free.app`

---

### Autenticación Básica

```cmd
ngrok http 5000 --basic-auth="usuario:password"
```

---

### Ver Solo Requests HTTP

```cmd
ngrok http 5000 --log=stdout
```

---

## 📊 Comparativa: ngrok vs Cloudflare

### Para Desarrollo/Testing:
```
🏆 ngrok (más fácil, dashboard web, más estable)
```

### Para Producción con URL Fija:
```
🏆 Cloudflare Tunnel (gratis, URL permanente)
```

---

## 🐛 Troubleshooting

### Error: "authtoken not found"

**Solución**: Configura el authtoken:
```cmd
ngrok config add-authtoken TU_TOKEN
```

---

### Error: "port 5000 already in use"

**Solución**: El servidor ya está corriendo o hay otro proceso:
```cmd
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

---

### La URL da 404

**Solución**:
1. Verifica que el servidor esté corriendo: `curl http://localhost:5000/health`
2. Verifica que ngrok apunte al puerto correcto: `ngrok http 5000`
3. Revisa el dashboard: http://localhost:4040

---

### ngrok se cierra automáticamente

**Causa**: Límite de tiempo en plan gratuito (2 horas)

**Solución**: Reinicia ngrok o actualiza a plan Pro

---

## ✅ Checklist Pre-ngrok

- [ ] ngrok instalado (`ngrok version`)
- [ ] Cuenta creada en ngrok.com
- [ ] Authtoken configurado (`ngrok config add-authtoken`)
- [ ] Servidor Flask corriendo en localhost:5000
- [ ] `curl http://localhost:5000/health` funciona

---

## 🚀 Workflow Diario con ngrok

### Iniciar Servidor y ngrok:

```cmd
REM Opción 1: Script automático
8-iniciar-todo-ngrok.bat

REM Opción 2: Manual
REM Ventana 1:
set PORT=5000
python server.py

REM Ventana 2:
ngrok http 5000
```

### Usar en Frontend:

```javascript
const BACKEND_URL = 'https://tu-url.ngrok-free.app';

fetch(`${BACKEND_URL}/health`)
  .then(res => res.json())
  .then(data => console.log(data));
```

### Ver Requests en Tiempo Real:

Abre: http://localhost:4040

---

## 📝 Scripts Disponibles

```
instalar-ngrok.bat              ← Instalar ngrok
configurar-ngrok.bat            ← Configurar authtoken (primera vez)
7-iniciar-con-ngrok.bat         ← Solo ngrok (servidor ya corriendo)
8-iniciar-todo-ngrok.bat        ← TODO automático (RECOMENDADO) ⭐
```

---

## 🎯 Próximo Paso AHORA

1. **Instala ngrok**:
   ```cmd
   winget install ngrok
   ```
   O: `instalar-ngrok.bat`

2. **Configura authtoken** (solo primera vez):
   ```cmd
   configurar-ngrok.bat
   ```

3. **Inicia todo**:
   ```cmd
   8-iniciar-todo-ngrok.bat
   ```

4. **Copia la URL** que aparece

5. **Prueba**: `https://tu-url.ngrok-free.app/health`

---

## 💡 Tips

- **Dashboard web**: Siempre abre http://localhost:4040 para ver requests
- **URL cambia**: Cada vez que reinicias ngrok, la URL cambia
- **Plan Pro**: Si necesitas URL fija, cuesta $8/mes
- **Límite gratuito**: 2 horas por sesión, suficiente para desarrollo

---

¡ngrok es mucho más simple que Cloudflare Tunnel! Prueba y me cuentas cómo te va. 🚀




