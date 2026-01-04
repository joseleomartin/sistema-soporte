# 🔄 Actualizar URL de ngrok en Vercel (Guía Rápida)

## ⚡ Pasos Rápidos

Cada vez que reinicies ngrok y obtengas una nueva URL:

### 1. Obtener Nueva URL de ngrok

Cuando ejecutes `ngrok http 5000`, copia la nueva URL:
```
https://nueva-url-xxxxx.ngrok-free.app
```

### 2. Actualizar en Vercel

1. Ve a: https://vercel.com/dashboard
2. Tu proyecto → **Settings** → **Environment Variables**
3. Busca: `VITE_EXTRACTOR_API_URL`
4. Click en **"Edit"**
5. Cambia el valor a la nueva URL
6. **Save**

### 3. Redesplegar

**Opción A: Dashboard**
- Deployments → Último deployment → Menu (⋮) → **Redeploy**

**Opción B: Git**
```cmd
git commit --allow-empty -m "Update ngrok URL"
git push
```

### 4. Esperar 1-2 minutos

Vercel redesplegará automáticamente con la nueva URL.

---

## 🎯 URL Actual

```
https://fc63ed9fc1c7.ngrok-free.app
```

**Actualiza esta URL en Vercel cuando reinicies ngrok.**

---

## 💡 Pro Tip

Si usas ngrok frecuentemente, considera:
- **ngrok Pro** ($8/mes): URL fija que no cambia
- **Cloudflare Tunnel permanente**: Gratis, URL fija

Así no necesitas actualizar Vercel cada vez.

























