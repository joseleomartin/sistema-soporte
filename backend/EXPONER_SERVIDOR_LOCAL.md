# 🌐 Exponer Servidor Local a Internet

## Comparativa de Opciones

| Herramienta | Gratis | URL Estable | Fácil | HTTPS | Recomendación |
|-------------|--------|-------------|-------|-------|---------------|
| **Cloudflare Tunnel** | ✅ | ✅ | ⭐⭐⭐⭐ | ✅ | 🏆 **MEJOR** |
| ngrok (Free) | ✅ | ❌ | ⭐⭐⭐⭐⭐ | ✅ | 🧪 Testing |
| ngrok (Pro) | 💰 $8/mes | ✅ | ⭐⭐⭐⭐⭐ | ✅ | 💰 Si pagas |
| LocalTunnel | ✅ | ❌ | ⭐⭐⭐ | ✅ | ⚠️ Menos estable |
| Serveo | ✅ | ❌ | ⭐⭐⭐ | ✅ | ⚠️ Inestable |

---

## 🏆 OPCIÓN 1: Cloudflare Tunnel (RECOMENDADO)

### ✅ Por Qué Es la Mejor Opción
- **100% Gratis** sin límites
- **URL estable** que no cambia
- **Muy rápido** (red global de Cloudflare)
- **HTTPS automático** (SSL gratis)
- **No requiere abrir puertos** en tu router
- **Sin límites de ancho de banda**
- **Profesional** - usado por empresas grandes

---

### 📦 Instalación (Solo Primera Vez)

#### Windows (Tu Caso):

```powershell
# Opción A: Con winget (Recomendado)
winget install --id Cloudflare.cloudflared

# Opción B: Con Chocolatey
choco install cloudflared

# Opción C: Descarga manual
# https://github.com/cloudflare/cloudflared/releases/latest
# Descarga: cloudflared-windows-amd64.exe
```

Verificar instalación:
```powershell
cloudflared --version
```

---

### 🚀 Uso Rápido (1 Comando)

```powershell
# 1. Inicia tu servidor
cd C:\Users\relim\Desktop\bolt\project\backend
$env:PORT=5000
python server.py

# 2. En OTRA ventana PowerShell, crea el túnel
cloudflared tunnel --url http://localhost:5000
```

**Salida**:
```
Your quick Tunnel has been created! Visit it at:
https://clever-sheep-1234.trycloudflare.com
```

**🎯 Copia esa URL y úsala en tu frontend!**

---

### 🎯 Script Automático (Más Fácil)

Ya creé 2 scripts para ti:

#### Opción A: Doble Click (Archivo .bat)

```powershell
# Simplemente haz doble click en:
iniciar-servidor-publico.bat
```

#### Opción B: PowerShell (Más control)

```powershell
# Ejecuta:
.\iniciar-servidor-publico.ps1
```

Ambos scripts:
1. ✅ Inician el servidor Flask
2. ✅ Crean el túnel de Cloudflare
3. ✅ Te muestran la URL pública
4. ✅ Limpian todo al cerrar (Ctrl+C)

---

### 🔒 Túnel Permanente (URL Fija 100%)

**Si quieres que la URL NUNCA cambie:**

#### Paso 1: Login (Solo Primera Vez)

```powershell
cloudflared tunnel login
```

Se abrirá el navegador. Crea cuenta gratis en Cloudflare si no tienes.

---

#### Paso 2: Crear Túnel Permanente

```powershell
cloudflared tunnel create extractores-backend
```

**Salida**:
```
Created tunnel extractores-backend with id abc123-def456-...
```

---

#### Paso 3: Configurar el Túnel

Crea el archivo: `C:\Users\relim\.cloudflared\config.yml`

```yaml
tunnel: extractores-backend
credentials-file: C:\Users\relim\.cloudflared\abc123-def456.json

ingress:
  - hostname: extractores.tusubdominio.com
    service: http://localhost:5000
  - service: http_status:404
```

**Reemplaza**:
- `abc123-def456.json` por el archivo que se creó
- `extractores.tusubdominio.com` por un subdominio tuyo

**¿No tienes dominio?** Cloudflare te da uno gratis tipo `xxxx.trycloudflare.com`

---

#### Paso 4: Configurar DNS

```powershell
cloudflared tunnel route dns extractores-backend extractores.tusubdominio.com
```

---

#### Paso 5: Iniciar Túnel Permanente

```powershell
# Cada vez que quieras levantar el servidor:
cloudflared tunnel run extractores-backend
```

**¡La URL nunca cambiará!** Siempre será `https://extractores.tusubdominio.com`

---

### 🔄 Workflow Diario con Cloudflare

**Método Simple (URL cambia cada vez)**:

```powershell
# Terminal 1: Servidor
cd project\backend
$env:PORT=5000
python server.py

# Terminal 2: Túnel
cloudflared tunnel --url http://localhost:5000
# Copia la URL que aparece
```

**Método Permanente (URL fija)**:

```powershell
# Terminal 1: Servidor
cd project\backend
$env:PORT=5000
python server.py

# Terminal 2: Túnel
cloudflared tunnel run extractores-backend
# Usa siempre: https://extractores.tusubdominio.com
```

---

## ⚡ OPCIÓN 2: ngrok (Alternativa Fácil)

### ✅ Ventajas
- Muy fácil de usar
- Interfaz web para ver requests
- Dashboard con estadísticas

### ❌ Desventajas
- Plan gratuito: URL cambia cada vez
- Plan Pro ($8/mes): URL estable

---

### 📦 Instalación

```powershell
# Con Chocolatey
choco install ngrok

# O descarga manual
# https://ngrok.com/download
```

---

### 🚀 Uso

```powershell
# 1. Crear cuenta gratis: https://ngrok.com/signup
# 2. Copiar tu authtoken del dashboard
# 3. Autenticar (solo primera vez)
ngrok config add-authtoken TU_TOKEN_AQUI

# 4. Iniciar servidor
cd project\backend
$env:PORT=5000
python server.py

# 5. En otra terminal, crear túnel
ngrok http 5000
```

**Salida**:
```
Forwarding: https://abc123.ngrok-free.app -> http://localhost:5000
```

---

### 💰 ngrok Pro (URL Estable)

**Si pagas $8/mes**:

```powershell
ngrok http 5000 --domain=tu-dominio.ngrok-free.app
```

La URL será siempre la misma.

---

## 🌐 OPCIÓN 3: LocalTunnel (Más Simple)

### 📦 Instalación

```powershell
npm install -g localtunnel
```

### 🚀 Uso

```powershell
# 1. Iniciar servidor
cd project\backend
$env:PORT=5000
python server.py

# 2. Crear túnel
lt --port 5000 --subdomain extractores-backend
```

**URL**: `https://extractores-backend.loca.lt`

⚠️ **Problema**: A veces el subdominio está ocupado y te da uno random.

---

## 📊 Comparativa Detallada

### Para Desarrollo/Testing Rápido
```
1. ngrok (más fácil, pero URL cambia)
2. Cloudflare Tunnel modo rápido
3. LocalTunnel
```

### Para Uso en Producción/Frontend Real
```
1. 🏆 Cloudflare Tunnel permanente (URL fija, gratis)
2. ngrok Pro (URL fija, $8/mes)
3. Railway/Vercel/Render (hosting real)
```

---

## 🎯 Mi Recomendación para Tu Caso

**Basándome en que quieres**:
- ✅ URL estable (no cambiarla en frontend)
- ✅ Gratis
- ✅ Sencillo

### **→ Cloudflare Tunnel Permanente** 🏆

**Setup inicial** (10 minutos, solo una vez):
```powershell
# 1. Instalar
winget install --id Cloudflare.cloudflared

# 2. Login
cloudflared tunnel login

# 3. Crear túnel
cloudflared tunnel create extractores

# 4. Configurar (ver Paso 3 arriba)

# 5. Configurar DNS
cloudflared tunnel route dns extractores extractores.tudominio.com
```

**Uso diario** (10 segundos):
```powershell
# Terminal 1: Servidor
cd project\backend
$env:PORT=5000
python server.py

# Terminal 2: Túnel
cloudflared tunnel run extractores
```

**URL en frontend** (nunca cambia):
```javascript
const BACKEND_URL = 'https://extractores.tudominio.com';
```

---

## 🔧 Configurar Frontend para Usar la URL

### React/Vue/Vite

Edita tu archivo `.env` o configuración:

```env
VITE_BACKEND_URL=https://tu-url-cloudflare.com
```

### JavaScript Directo

```javascript
// En tu código frontend
const BACKEND_URL = 'https://tu-url-cloudflare.com';

// Hacer request
fetch(`${BACKEND_URL}/health`)
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## 🐛 Troubleshooting

### Error: "cloudflared: command not found"

**Solución**:
```powershell
# Reinicia PowerShell después de instalar
# O especifica la ruta completa:
& "C:\Program Files\cloudflared\cloudflared.exe" tunnel --url http://localhost:5000
```

---

### Error: "Connection refused"

**Causa**: El servidor no está corriendo

**Solución**:
```powershell
# Verifica que el servidor esté corriendo
curl http://localhost:5000/health
```

---

### La URL de Cloudflare no responde

**Solución**:
```powershell
# 1. Verifica que el servidor local funciona
curl http://localhost:5000/health

# 2. Verifica que el túnel esté corriendo
# Deberías ver: "Connection established"

# 3. Prueba la URL pública
curl https://tu-url-cloudflare.com/health
```

---

## 📝 Resumen Rápido

**Para empezar YA (5 minutos)**:
```powershell
# 1. Instalar Cloudflare
winget install --id Cloudflare.cloudflared

# 2. Iniciar servidor
cd project\backend
$env:PORT=5000
python server.py

# 3. En otra terminal, crear túnel
cloudflared tunnel --url http://localhost:5000

# 4. Copiar URL que aparece y usarla en frontend
```

**Para URL permanente** (usa la guía del túnel permanente arriba).

---

## 🎉 Listo!

Tu servidor local ahora está accesible desde internet con una URL estable. 

**Ejemplo de uso en frontend**:
```javascript
// App.js o donde hagas las llamadas API
const API_URL = 'https://tu-url-cloudflare.com';

// Listar extractores
fetch(`${API_URL}/extractors`)
  .then(res => res.json())
  .then(data => console.log(data.extractors));

// Extraer PDF
const formData = new FormData();
formData.append('pdf', pdfFile);
formData.append('banco', 'banco_galicia');

fetch(`${API_URL}/extract`, {
  method: 'POST',
  body: formData
})
  .then(res => res.json())
  .then(data => console.log(data));
```

---

¿Problemas? Comparte el error y te ayudo. 🚀




