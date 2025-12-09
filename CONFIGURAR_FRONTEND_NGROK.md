# 🔗 Configurar Frontend con ngrok

## ✅ Ya Configurado

He actualizado tu frontend para usar la URL de ngrok. Los cambios realizados:

1. ✅ Creado archivo `.env.local` con tu URL de ngrok
2. ✅ Actualizado `PDFtoOCR.tsx` para usar la variable de entorno
3. ✅ `TableExtractor.tsx` ya estaba configurado correctamente

---

## 📝 Archivo `.env.local`

He creado el archivo `project/.env.local` con:

```env
VITE_EXTRACTOR_API_URL=https://fc63ed9fc1c7.ngrok-free.app
```

**⚠️ IMPORTANTE**: Cada vez que reinicies ngrok, la URL cambiará. Debes actualizar este archivo.

---

## 🚀 Pasos para Usar

### PASO 1: Reiniciar el Servidor de Desarrollo

Las variables de entorno de Vite solo se cargan al iniciar el servidor.

```cmd
cd project

REM Si el servidor ya está corriendo, detenlo (Ctrl+C)
REM Luego reinicia:
npm run dev
```

---

### PASO 2: Verificar que Funciona

Abre tu aplicación en el navegador y prueba:

1. **Extraer datos de un PDF**:
   - Ve a la sección de Extractores
   - Sube un PDF
   - Selecciona un banco
   - Click en "Extraer"

2. **Convertir PDF a OCR**:
   - Ve a la sección PDF to OCR
   - Sube un PDF
   - Click en "Convertir"

**Debería funcionar correctamente** usando la URL de ngrok.

---

## 🔄 Cuando Reinicies ngrok

Cada vez que reinicies ngrok, obtendrás una URL nueva. Debes:

### Opción 1: Actualizar `.env.local` Manualmente

1. Abre `project/.env.local`
2. Actualiza la URL:
   ```env
   VITE_EXTRACTOR_API_URL=https://nueva-url.ngrok-free.app
   ```
3. Reinicia el servidor de desarrollo:
   ```cmd
   npm run dev
   ```

### Opción 2: Script Automático (Próximamente)

Puedo crear un script que actualice automáticamente el `.env.local` cuando reinicies ngrok.

---

## 🎯 Verificar Configuración

Para verificar que la URL está configurada correctamente:

1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Network"
3. Intenta extraer un PDF
4. Verifica que las requests vayan a: `https://fc63ed9fc1c7.ngrok-free.app`

---

## 📊 Estructura de la Configuración

```
project/
├── .env.local                    ← URL del backend (ngrok)
├── src/
│   └── components/
│       └── Tools/
│           ├── TableExtractor.tsx  ← Usa VITE_EXTRACTOR_API_URL ✅
│           └── PDFtoOCR.tsx        ← Usa VITE_EXTRACTOR_API_URL ✅
```

---

## 🐛 Troubleshooting

### Problema: "Failed to fetch" o CORS error

**Causa**: ngrok puede mostrar una página de advertencia la primera vez

**Solución**: 
1. Abre la URL de ngrok directamente en el navegador: `https://fc63ed9fc1c7.ngrok-free.app`
2. Click en "Visit Site" para aceptar
3. Luego prueba desde tu frontend

---

### Problema: La URL no se actualiza

**Causa**: El servidor de desarrollo no se reinició

**Solución**:
```cmd
REM Detener servidor (Ctrl+C)
REM Reiniciar:
npm run dev
```

---

### Problema: "Network Error"

**Causa**: ngrok se desconectó o el servidor backend no está corriendo

**Solución**:
1. Verifica que ngrok esté corriendo
2. Verifica que el servidor Flask esté corriendo: `curl http://localhost:5000/health`
3. Verifica la URL en `.env.local`

---

## ✅ Checklist

- [x] Archivo `.env.local` creado con URL de ngrok
- [x] `PDFtoOCR.tsx` actualizado para usar variable de entorno
- [x] `TableExtractor.tsx` ya estaba configurado
- [ ] Servidor de desarrollo reiniciado (`npm run dev`)
- [ ] Probado extraer PDF desde el frontend
- [ ] Probado convertir PDF a OCR desde el frontend

---

## 🎉 ¡Listo!

Tu frontend ahora está conectado con el backend a través de ngrok. 

**Próximo paso**: Reinicia el servidor de desarrollo y prueba extraer un PDF.

---

## 💡 Tips

- **URL cambia**: Cada vez que reinicias ngrok, actualiza `.env.local`
- **Dashboard ngrok**: Abre http://localhost:4040 para ver todas las requests
- **Debugging**: Revisa la consola del navegador (F12) para ver errores

---

¿Funcionó? Si tienes algún problema, comparte el error y te ayudo. 🚀
















