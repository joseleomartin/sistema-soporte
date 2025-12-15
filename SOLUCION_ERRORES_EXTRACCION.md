# 🔧 Solución: Errores en Extracción

## ✅ Error 1: `setResult is not defined` - SOLUCIONADO

**Problema**: El código usaba `setResult` que no estaba definido.

**Solución**: Reemplazado con `setLocalMessage` que sí está definido.

**Archivo corregido**: `src/components/Tools/TableExtractor.tsx`

---

## 🐛 Error 2: Error 500 del Servidor

**Problema**: El servidor responde con error 500 al procesar el PDF.

**Posibles causas**:
1. El archivo PDF no se está enviando correctamente
2. El servidor no puede procesar el PDF
3. Falta alguna dependencia en el servidor
4. Error en el extractor específico del banco

---

## 🔍 Diagnóstico del Error 500

### PASO 1: Verificar Logs del Servidor

En la ventana donde está corriendo el servidor Flask, busca errores como:

```
ERROR: Error durante la extracción: ...
Traceback (most recent call last):
...
```

**Comparte esos logs** para diagnosticar el problema.

---

### PASO 2: Verificar que el Servidor Recibe el Archivo

En los logs del servidor, deberías ver:

```
[INFO] Request recibido: POST /extract
[INFO] Form data keys: ['banco', 'pdf']
[INFO] Files: ['pdf']
```

Si no ves esto, el archivo no se está enviando correctamente.

---

### PASO 3: Probar Endpoint Directamente

Prueba hacer una request directa al servidor:

```bash
curl -X POST https://fc63ed9fc1c7.ngrok-free.app/extract \
  -F "pdf=@/ruta/a/tu/archivo.pdf" \
  -F "banco=banco_galicia"
```

**Si esto funciona**, el problema está en el frontend.
**Si esto falla**, el problema está en el servidor.

---

## 🎯 Soluciones Comunes

### Solución 1: Verificar Tamaño del Archivo

ngrok tiene límites de tamaño. Si el PDF es muy grande (>10MB), puede fallar.

**Solución**: Prueba con un PDF más pequeño primero.

---

### Solución 2: Verificar que el Archivo se Envía

En el código, el archivo se envía así:

```typescript
formData.append('pdf', selectedFile);
formData.append('banco', selectedBanco);
```

**Verifica** que `selectedFile` no sea `null` cuando se hace el fetch.

---

### Solución 3: Verificar Headers CORS

El servidor debe tener CORS configurado. Ya está configurado en `server.py`:

```python
CORS(app, resources={r"/*": {"origins": "*"}})
```

Pero ngrok puede requerir headers adicionales.

---

### Solución 4: Verificar Logs del Servidor

**Lo más importante**: Revisa los logs del servidor Flask cuando haces la request.

Deberías ver:
- ✅ Request recibido
- ✅ Archivo guardado
- ✅ Extractor ejecutado
- ❌ O algún error específico

**Comparte esos logs** para diagnosticar.

---

## 📝 Checklist de Verificación

- [x] Error `setResult` corregido (código actualizado)
- [ ] Código actualizado desplegado en Vercel
- [ ] Servidor Flask corriendo y accesible
- [ ] ngrok túnel activo
- [ ] Logs del servidor revisados
- [ ] PDF de prueba pequeño (<5MB)

---

## 🚀 Próximos Pasos

1. **Hacer commit y push** del fix de `setResult`:
   ```cmd
   git add project/src/components/Tools/TableExtractor.tsx
   git commit -m "Fix: Replace setResult with setLocalMessage"
   git push
   ```

2. **Esperar redeploy en Vercel** (automático)

3. **Probar de nuevo** la extracción

4. **Revisar logs del servidor** cuando haga la request

5. **Compartir logs** si sigue fallando

---

## 🔍 Para Diagnosticar el Error 500

**Necesito que compartas**:

1. Los logs del servidor Flask cuando haces la request
2. El tamaño del PDF que estás intentando procesar
3. El banco que seleccionaste
4. Si el error es consistente o solo con ciertos PDFs/bancos

---

¿Puedes compartir los logs del servidor cuando intentas extraer un PDF? 🔍



















