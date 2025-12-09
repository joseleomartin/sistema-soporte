# Corrección de errores 400 en Storage (Signed URLs)

## Problema
Error `400 (Bad Request)` al intentar crear URLs firmadas para imágenes en el chat.

## Causa
Las políticas RLS de Supabase Storage no están permitiendo correctamente la creación de signed URLs debido a:
1. Uso de `storage.foldername()` que puede no funcionar en todos los casos
2. Permisos insuficientes para usuarios que son destinatarios (segunda parte del path)

## Solución

### Paso 1: Ejecutar el script de corrección SQL

1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard
2. Abre el **SQL Editor**
3. Carga y ejecuta el archivo: `FIX_STORAGE_RLS_POLICIES.sql`
4. Verifica que todas las consultas se ejecuten sin errores

### Paso 2: Verificar las políticas

El script mostrará al final las políticas creadas. Debes ver:
- ✅ `Users can view their conversation attachments` (SELECT)
- ✅ `Users can upload attachments` (INSERT)
- ✅ `Users can update their own attachments` (UPDATE)
- ✅ `Users can delete their own attachments` (DELETE)

### Paso 3: Probar la aplicación

1. Recarga la aplicación en el navegador (Ctrl+R o Cmd+R)
2. Abre una conversación con imágenes
3. Las imágenes deberían cargar sin errores 400
4. Verifica en la consola del navegador (F12) que no hay errores

## Mejoras implementadas en el código

### 1. Cache de URLs firmadas
- Las URLs firmadas se cachean por 50 minutos
- Evita recrear URLs constantemente
- Reduce la carga en el servidor de Supabase

### 2. Políticas RLS mejoradas
- Usa `string_to_array()` en lugar de `storage.foldername()`
- Permite acceso tanto al remitente (primera parte del path) como al destinatario (segunda parte)
- Verificación adicional en la base de datos para mayor seguridad

### 3. Mejor manejo de errores
- Logs detallados de errores en consola
- Fallback a método `download()` si `createSignedUrl()` falla
- Mensajes de error más descriptivos para el usuario

## Estructura del path de archivos

Los archivos se guardan con este formato:
```
{sender_id}/{receiver_id}/{timestamp-random}.{extension}
```

Ejemplo:
```
3db7be28-1028-4fbd-b466-9fa6c358d2fe/0d010635-054d-4049-8b75-73a532a01706/1764359601782-in5c2h.png
```

Las políticas RLS permiten acceso a:
- `sender_id` (primera parte): puede ver, actualizar y eliminar
- `receiver_id` (segunda parte): puede ver
- Verificación adicional: usuarios que son parte del mensaje en la BD

## Si persisten los errores

1. **Verificar autenticación:**
   ```javascript
   const { data: { session } } = await supabase.auth.getSession();
   console.log('Session:', session);
   ```

2. **Verificar bucket:**
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'direct-message-attachments';
   ```

3. **Verificar archivos en storage:**
   - Ve a Storage > direct-message-attachments en el dashboard de Supabase
   - Verifica que los archivos existan

4. **Verificar registros en BD:**
   ```sql
   SELECT 
     dma.file_path,
     dma.file_name,
     dm.sender_id,
     dm.receiver_id
   FROM direct_message_attachments dma
   JOIN direct_messages dm ON dm.id = dma.message_id
   ORDER BY dma.created_at DESC
   LIMIT 10;
   ```

5. **Limpiar cache del navegador:**
   - Chrome/Edge: Ctrl+Shift+Delete > Clear browsing data
   - Firefox: Ctrl+Shift+Delete > Clear recent history

## Contacto
Si el problema persiste después de seguir estos pasos, comparte:
- Los logs completos de la consola del navegador
- El resultado de las consultas SQL de verificación
- Capturas de pantalla del error











