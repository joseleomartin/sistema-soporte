# 📧 Configurar Webhook para Emails (Alternativa a pg_net)

Si `pg_net` no está funcionando correctamente, puedes usar **Database Webhooks** de Supabase, que es más confiable para este caso.

## 🚀 Pasos para Configurar el Webhook

### 1. Ir a Database Webhooks

1. Ve a **Supabase Dashboard**
2. Ve a **Database** > **Webhooks**
3. Haz clic en **"Create a new webhook"**

### 2. Configurar el Webhook

#### Información Básica:
- **Name**: `Send notification emails`
- **Table**: `notifications`
- **Events**: Selecciona solo **INSERT**

#### HTTP Request:
- **URL**: `https://yevbgutnuoivcuqnmrzi.supabase.co/functions/v1/resend-email`
- **HTTP Method**: `POST`
- **HTTP Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldmJndXRudW9pdmN1cW5tcnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTI0NTQsImV4cCI6MjA3ODQ2ODQ1NH0.COkMSMvFvpCM2q9FC0fYukS-mCzLacqilH9q1aHAQR4
  ```
- **Request Body Type**: `JSON`

#### Request Body (Template):

```json
{
  "to": "{{(SELECT email FROM profiles WHERE id = (record.user_id)::uuid LIMIT 1)}}",
  "subject": "{{record.title}}",
  "html": "<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;\"><div style=\"background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;\"><h1 style=\"color: white; margin: 0; font-size: 24px;\">EmaGroup</h1></div><div style=\"background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;\"><h2 style=\"color: #111827; margin-top: 0; font-size: 20px;\">{{record.title}}</h2><p style=\"color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;\">{{record.message}}</p><div style=\"margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;\"><p style=\"color: #6b7280; font-size: 14px; margin: 0;\">Puedes ver todas tus notificaciones en la plataforma EmaGroup.</p></div></div><div style=\"text-align: center; margin-top: 20px;\"><p style=\"color: #9ca3af; font-size: 12px;\">Este es un email automático, por favor no respondas.</p></div></div>"
}
```

**⚠️ IMPORTANTE**: El template de webhooks de Supabase tiene limitaciones. Si el template complejo no funciona, usa esta versión simplificada:

```json
{
  "to": "{{(SELECT email FROM profiles WHERE id = (record.user_id)::uuid LIMIT 1)}}",
  "subject": "{{record.title}}",
  "html": "<div><h2>{{record.title}}</h2><p>{{record.message}}</p></div>"
}
```

### 3. Filtrar Solo Notificaciones Relevantes

En la sección **"Filter"** del webhook, agrega:

```sql
type != 'direct_message'
```

Esto evitará que se envíen emails para mensajes directos.

### 4. Guardar y Probar

1. Haz clic en **"Save"** o **"Create webhook"**
2. Crea una notificación de prueba
3. Revisa los logs del webhook en **Database** > **Webhooks** > **[Tu webhook]** > **Logs**
4. Revisa los logs de la Edge Function en **Edge Functions** > **resend-email** > **Logs**

## 🔍 Ventajas de Webhooks vs pg_net

✅ **Más confiable**: Diseñado específicamente para este propósito
✅ **Mejor logging**: Puedes ver el historial completo de peticiones
✅ **Reintentos automáticos**: Si falla, Supabase reintenta
✅ **No requiere pg_net**: Funciona sin extensiones adicionales

## ⚠️ Limitaciones de los Templates

Los webhooks de Supabase tienen limitaciones en los templates:
- No puedes hacer queries SQL complejas en el template
- El HTML debe estar en una sola línea o usar escapes

**Solución**: Si el template no funciona, puedes:
1. Usar el template simple (solo `to`, `subject`, `html` básico)
2. Modificar la Edge Function para construir el HTML completo
3. O usar una función SQL que prepare el payload

## 🔧 Alternativa: Modificar Edge Function para Construir HTML

Si los templates son muy limitados, puedes modificar la Edge Function `resend-email` para que construya el HTML completo:

```typescript
// En resend-email/index.ts
const { to, subject, message } = await req.json()

// Construir HTML completo aquí
const html = `
  <div style="...">
    <h2>${subject}</h2>
    <p>${message}</p>
  </div>
`
```

Y en el webhook, usar un template más simple:

```json
{
  "to": "{{(SELECT email FROM profiles WHERE id = (record.user_id)::uuid LIMIT 1)}}",
  "subject": "{{record.title}}",
  "message": "{{record.message}}"
}
```










