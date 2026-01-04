# 💳 Configuración de Mercado Pago

## 🔑 Credenciales de Testing

Las siguientes credenciales están configuradas para **testing**:

- **Public Key**: `TEST-66c930bd-cd83-4f1f-9b2a-e4e61ab8d34a`
- **Access Token**: `TEST-4695715759543089-010316-f6747241113849c50f351eda0b12b7b8-586133200`

⚠️ **IMPORTANTE**: Estas credenciales están hardcodeadas en `project/src/lib/mercadoPago.ts` para facilitar el testing.

## ⚠️ IMPORTANTE: Seguridad en Producción

**En producción, NUNCA debes exponer el Access Token en el frontend.** 

### Opción Recomendada: Backend

1. **Mover la creación de preferencias al backend**:
   - El Access Token debe estar solo en el servidor
   - Crear un endpoint en tu backend (Flask/Python) que cree la preferencia
   - El frontend solo llama a tu backend, no directamente a Mercado Pago

2. **Configurar variables de entorno en el backend**:
   ```env
   MERCADO_PAGO_ACCESS_TOKEN=TU_ACCESS_TOKEN_PRODUCCION
   MERCADO_PAGO_PUBLIC_KEY=TU_PUBLIC_KEY_PRODUCCION
   ```

3. **Actualizar el frontend** para llamar a tu backend:
   ```typescript
   // En lugar de llamar directamente a Mercado Pago
   const response = await fetch(`${BACKEND_URL}/api/mercadopago/create-preference`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(params)
   });
   ```

## 🧪 Testing

El sistema está configurado para usar las credenciales de **testing** de Mercado Pago.

### Flujo de Prueba

1. Click en "Activar Suscripción Ahora"
2. Serás redirigido a Mercado Pago (modo sandbox/testing)
3. Usa una tarjeta de prueba (ver abajo)
4. Completa el pago
5. Serás redirigido de vuelta a la aplicación
6. La suscripción se activará automáticamente

### Tarjetas de Prueba

Para probar el sistema de pagos, usa estas tarjetas de prueba de Mercado Pago:

- **Aprobada**: `5031 7557 3453 0604` (CVV: 123, Fecha: cualquier fecha futura)
- **Rechazada**: `5031 4332 1540 6351` (CVV: 123, Fecha: cualquier fecha futura)
- **Pendiente**: `5031 7557 3453 0604` (CVV: 123, Fecha: cualquier fecha futura)

### Cambiar a Producción

Cuando estés listo para producción, cambia las credenciales en `project/src/lib/mercadoPago.ts` a las credenciales de producción de Mercado Pago.

## 🔄 Callbacks y Webhooks

### Callbacks (URLs de retorno)

Cuando el usuario completa el pago, Mercado Pago redirige a:
- **Success**: `/subscription?status=success&tenant_id=...`
- **Failure**: `/subscription?status=failure&tenant_id=...`
- **Pending**: `/subscription?status=pending&tenant_id=...`

El componente `SubscriptionManagement` maneja automáticamente estos callbacks.

### Webhooks (Para producción)

Para recibir notificaciones automáticas de Mercado Pago:

1. **Configurar endpoint en tu backend**:
   ```
   POST /api/mercadopago/webhook
   ```

2. **Registrar la URL en Mercado Pago**:
   - Ve a tu cuenta de Mercado Pago
   - Configuración → Webhooks
   - Agrega: `https://tu-backend.com/api/mercadopago/webhook`

3. **Verificar la firma del webhook**:
   ```python
   # En tu backend
   import hmac
   import hashlib
   
   x_signature = request.headers.get('x-signature')
   x_request_id = request.headers.get('x-request-id')
   
   # Verificar firma con tu Access Token
   ```

## 📝 Archivos Modificados

1. **`project/src/lib/mercadoPago.ts`**: Servicio de Mercado Pago
2. **`project/src/components/Subscription/MercadoPagoCheckout.tsx`**: Componente de checkout
3. **`project/src/components/Subscription/SubscriptionManagement.tsx`**: Integración del checkout

## 🚀 Estado Actual

1. ✅ Credenciales de testing configuradas
2. ✅ Modo sandbox activado (usa `sandbox_init_point`)
3. ✅ URLs de retorno configuradas (se adaptan automáticamente según el entorno)
4. ✅ Listo para probar con tarjetas de prueba
5. ⚠️ **PENDIENTE**: Cambiar a credenciales de producción cuando esté listo
6. ⚠️ **PENDIENTE**: Mover Access Token al backend (actualmente está en el frontend)
7. ⚠️ **PENDIENTE**: Crear endpoint en backend para crear preferencias
8. ⚠️ **PENDIENTE**: Configurar webhooks

## ⚠️ Seguridad Crítica

**El Access Token está actualmente expuesto en el frontend.** Esto es un riesgo de seguridad.

**Recomendación inmediata**: Mover la creación de preferencias al backend lo antes posible.

## 🔧 Solución de Problemas

### Error: "Necesitás un permiso para hacer el pago"

Este error indica que la aplicación de Mercado Pago no tiene los permisos necesarios. Para resolverlo:

#### 1. Verificar en el Panel de Desarrolladores

1. Ve a [Panel de Desarrolladores de Mercado Pago](https://www.mercadopago.com.ar/developers/panel)
2. Inicia sesión con tu cuenta de Mercado Pago
3. Selecciona tu aplicación (o crea una nueva si no tienes)
4. Ve a la sección **"Credenciales"** o **"Aplicaciones"**

#### 2. Verificar Permisos de la Aplicación

Asegúrate de que tu aplicación tenga habilitados los siguientes permisos/scopes:

- ✅ **Crear preferencias de pago** (Checkout Pro)
- ✅ **Procesar pagos**
- ✅ **Recibir notificaciones de pagos**

#### 3. Verificar Estado de la Cuenta

- La cuenta debe estar **verificada** y **habilitada para producción**
- Si la cuenta está en proceso de verificación, puede que algunos permisos estén limitados
- Contacta al soporte de Mercado Pago si la cuenta no está completamente activada

#### 4. Verificar Credenciales

- Confirma que estás usando el **Access Token de producción** correcto
- El Access Token debe comenzar con `APP_USR-` (no `TEST-`)
- Verifica que el Access Token corresponda a la aplicación correcta

#### 5. Si el Problema Persiste

1. **Contacta al administrador de la cuenta de Mercado Pago** para solicitar los permisos necesarios
2. **Verifica en el panel** que la aplicación tenga el estado "Activa" o "Habilitada"
3. **Contacta al soporte de Mercado Pago** si necesitas ayuda adicional

#### 6. Verificar en la Consola del Navegador

Abre la consola del navegador (F12) y revisa:
- El error completo que devuelve la API de Mercado Pago
- El código de estado HTTP (debería ser 403 si es un problema de permisos)
- Los detalles del error en `errorData`

## 📚 Documentación de Mercado Pago

- [Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing)
- [API de Preferencias](https://www.mercadopago.com.ar/developers/es/reference/preferences/_checkout_preferences/post)
- [Webhooks](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks)

