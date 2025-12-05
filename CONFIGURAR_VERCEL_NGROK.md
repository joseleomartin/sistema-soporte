# 🔗 Configurar Frontend en Vercel con ngrok

## 📍 Situación

- ✅ **Frontend**: Hosteado en Vercel
- ✅ **Backend**: Local con ngrok (`https://fc63ed9fc1c7.ngrok-free.app`)

---

## 🚀 Configurar Variable de Entorno en Vercel

### PASO 1: Ir al Dashboard de Vercel

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**

---

### PASO 2: Agregar Variable de Entorno

1. Click en **"Add New"**
2. **Name**: `VITE_EXTRACTOR_API_URL`
3. **Value**: `https://fc63ed9fc1c7.ngrok-free.app`
4. **Environments**: Selecciona:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. Click en **"Save"**

---

### PASO 3: Redesplegar

Después de agregar la variable, Vercel necesita redesplegar:

**Opción A: Desde el Dashboard**
1. Ve a la pestaña **"Deployments"**
2. Click en el menú (⋮) del último deployment
3. Click en **"Redeploy"**
4. Espera 1-2 minutos

**Opción B: Desde Git**
```cmd
git commit --allow-empty -m "Trigger redeploy - update ngrok URL"
git push
```

---

## ⚠️ IMPORTANTE: Cuando Reinicies ngrok

Cada vez que reinicies ngrok, obtendrás una URL nueva. Debes:

1. **Actualizar la variable en Vercel**:
   - Ve a Settings → Environment Variables
   - Edita `VITE_EXTRACTOR_API_URL`
   - Cambia el valor a la nueva URL de ngrok
   - Guarda

2. **Redesplegar** (mismo proceso de arriba)

---

## 🔄 Workflow Recomendado

### Para Desarrollo Local:

Crea un archivo `.env.local` en `project/`:

```env
VITE_EXTRACTOR_API_URL=https://fc63ed9fc1c7.ngrok-free.app
```

Luego ejecuta:
```cmd
cd project
npm run dev
```

Esto usa la URL de ngrok para desarrollo local.

---

### Para Producción (Vercel):

1. Configura la variable en Vercel Dashboard (como arriba)
2. Redesplega
3. Listo

---

## 🎯 Verificar que Funciona

### En Vercel (Producción):

1. Abre tu app en Vercel
2. Abre la consola del navegador (F12)
3. Ve a la pestaña "Network"
4. Intenta extraer un PDF
5. Verifica que las requests vayan a: `https://fc63ed9fc1c7.ngrok-free.app`

---

## 📝 Resumen de Pasos

1. ✅ Ve a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. ✅ Agrega: `VITE_EXTRACTOR_API_URL` = `https://fc63ed9fc1c7.ngrok-free.app`
3. ✅ Selecciona todos los environments (Production, Preview, Development)
4. ✅ Guarda
5. ✅ Redesplega (Deployments → Redeploy)
6. ✅ Prueba tu app en Vercel

---

## 🐛 Troubleshooting

### Problema: La variable no se aplica

**Solución**: 
- Asegúrate de redesplegar después de agregar/actualizar la variable
- Las variables de entorno solo se cargan durante el build

---

### Problema: CORS Error

**Solución**:
1. Abre la URL de ngrok directamente: `https://fc63ed9fc1c7.ngrok-free.app`
2. Click en "Visit Site" para aceptar
3. Luego prueba desde Vercel

---

### Problema: URL cambia cada vez

**Solución**: 
- Usa ngrok con dominio fijo (Plan Pro: $8/mes)
- O actualiza la variable en Vercel cada vez que reinicies ngrok

---

## 💡 Tips

- **Dashboard ngrok**: Abre http://localhost:4040 para ver todas las requests
- **Variables en Vercel**: Se pueden tener diferentes valores para Production/Preview/Development
- **URL estable**: Si necesitas URL que no cambie, considera ngrok Pro o Cloudflare Tunnel permanente

---

## ✅ Checklist

- [ ] Variable `VITE_EXTRACTOR_API_URL` agregada en Vercel
- [ ] Valor configurado: `https://fc63ed9fc1c7.ngrok-free.app`
- [ ] Seleccionados todos los environments
- [ ] Proyecto redesplegado
- [ ] Probado desde Vercel (producción)
- [ ] Verificado en consola del navegador que las requests van a ngrok

---

¡Listo! Tu frontend en Vercel ahora está conectado con tu backend local a través de ngrok. 🚀












