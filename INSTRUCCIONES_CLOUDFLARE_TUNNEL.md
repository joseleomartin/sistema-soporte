## 🔒 Exponer el backend con Cloudflare Tunnel

Cloudflare Tunnel permite publicar `http://localhost:5000` en una URL pública segura sin abrir puertos ni pagar hosting. Perfecto para compartir los extractores mientras el backend sigue corriendo en tu PC.

---

### 1. Requisitos previos

- Navegador + cuenta gratuita en Cloudflare.
- Dominio administrado en Cloudflare. (Si no tienes uno, puedes comprar uno barato o transferirlo. El plan gratuito basta).
- Backend corriendo en tu máquina (`start.bat` → `http://0.0.0.0:5000`).

---

### 2. Instalar `cloudflared`

1. Descarga desde <https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/>.
2. En Windows, extrae el `cloudflared.exe` y colócalo en una carpeta incluida en el PATH (por ejemplo, `C:\Windows\System32\`) o guárdalo junto a `start.bat`.
3. Valida la instalación:
   ```powershell
   cloudflared --version
   ```

---

### 3. Autenticar con Cloudflare

```powershell
cloudflared login
```

Esto abrirá el navegador. Elige la cuenta y dominio donde quieres crear el túnel. Después de aceptar, se generará un certificado (`cert.pem`) en tu carpeta de usuario.

---

### 4. Crear el túnel

1. Desde una terminal en `project/backend`:
   ```powershell
   cloudflared tunnel create extractores-tunnel
   ```
   Guarda el UUID que aparece (`Tunnel credentials file saved to ...`).

2. Cloudflare habrá creado un archivo `extractores-tunnel.json` dentro de `%USERPROFILE%\.cloudflared`.

---

### 5. Asignar una URL pública

#### Opción A: subdominio propio

1. En el panel de Cloudflare, ve a **Zero Trust → Access → Tunnels**.
2. Selecciona el túnel creado → botón **Configure**.
3. En **Public Hostname**, añade:
   - **Subdomain**: ejemplo `extractores`.
   - **Domain**: tu dominio (ej. `midominio.com`).
   - **Type**: `HTTP`.
   - **URL**: `http://localhost:5000`.
4. Guarda. Cloudflare generará el registro DNS y te dará la URL final: `https://extractores.midominio.com`.

#### Opción B: usá `trycloudflare.com` (sin dominio propio)

Ejecuta directamente:
```powershell
cloudflared tunnel --url http://localhost:5000
```

Cloudflare te dará una URL aleatoria `https://algo.trycloudflare.com`. Mientras el comando esté corriendo, la URL funcionará. Para uso prolongado, es mejor la Opción A.

---

### 6. Ejecutar el túnel (opción A)

Una vez configurado el host público:

```powershell
cloudflared tunnel run extractores-tunnel
```

Déjalo corriendo en una ventana. La salida mostrará:
```
INF Starting tunnel tunnelID=... 
INF Route propagating, it may take up to 1 minute for your new route to become functional
```

---

### 7. Actualizar el frontend

- En Vercel y en tu `.env` local, define:
  ```env
  VITE_EXTRACTOR_API_URL=https://extractores.midominio.com
  ```
- Redeploy en Vercel y reinicia `npm run dev` en local.

Ahora todas las peticiones de `TableExtractor` van al túnel y Cloudflare las redirige a tu backend local.

---

### 8. Consideraciones

- Necesitas mantener **dos** terminales abiertas: una corriendo `start.bat` y otra `cloudflared tunnel run ...`.
- Si usas la opción `trycloudflare.com`, la URL cambia cada vez. Actualiza `VITE_EXTRACTOR_API_URL` cuando reinicies el túnel.
- Revisa los logs con:
  ```powershell
  cloudflared tunnel logs extractores-tunnel
  ```

---

¡Listo! Con Cloudflare Tunnel tu backend local queda accesible de forma segura y reversible, sin tocar el firewall del router. 🚀

























