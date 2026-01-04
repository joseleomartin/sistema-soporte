/**
 * Servicio de Mercado Pago
 * Integración con Mercado Pago para procesar pagos de suscripciones
 */

// Credenciales de Mercado Pago desde variables de entorno
// En Vercel, configura estas variables en Settings > Environment Variables:
// - VITE_MERCADO_PAGO_PUBLIC_KEY
// - VITE_MERCADO_PAGO_ACCESS_TOKEN
const MERCADO_PAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY || 'TEST-66c930bd-cd83-4f1f-9b2a-e4e61ab8d34a';
const MERCADO_PAGO_ACCESS_TOKEN = import.meta.env.VITE_MERCADO_PAGO_ACCESS_TOKEN || 'TEST-4695715759543089-010316-f6747241113849c50f351eda0b12b7b8-586133200';

// Validar que las credenciales estén configuradas
if (!MERCADO_PAGO_PUBLIC_KEY || !MERCADO_PAGO_ACCESS_TOKEN) {
  console.warn('⚠️ Las credenciales de Mercado Pago no están configuradas. Configura VITE_MERCADO_PAGO_PUBLIC_KEY y VITE_MERCADO_PAGO_ACCESS_TOKEN en las variables de entorno.');
}

export interface PaymentPreference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

export interface CreatePaymentPreferenceParams {
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
  tenant_id: string;
  user_count: number;
}

/**
 * Crea una preferencia de pago en Mercado Pago
 * Esta función debe ejecutarse en el backend por seguridad
 * Por ahora, la implementamos aquí para testing
 */
export async function createPaymentPreference(
  params: CreatePaymentPreferenceParams
): Promise<PaymentPreference> {
  const { title, description, quantity, unit_price, tenant_id, user_count } = params;

  // Validar que unit_price sea un número válido y mayor que 0
  const validatedUnitPrice = Number(unit_price);
  if (isNaN(validatedUnitPrice) || validatedUnitPrice <= 0) {
    throw new Error(`El precio unitario debe ser un número mayor que 0. Valor recibido: ${unit_price}`);
  }

  // Validar que quantity sea un número válido y mayor que 0
  const validatedQuantity = Number(quantity);
  if (isNaN(validatedQuantity) || validatedQuantity <= 0) {
    throw new Error(`La cantidad debe ser un número mayor que 0. Valor recibido: ${quantity}`);
  }

  try {
    // Construir URLs de retorno - asegurarse de que sean URLs válidas
    const baseUrl = window.location.origin;
    
    // Validar que baseUrl sea una URL válida
    if (!baseUrl || baseUrl === 'null' || baseUrl === 'undefined') {
      throw new Error('No se pudo determinar la URL base de la aplicación');
    }

    // Verificar si estamos en localhost
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.includes('0.0.0.0');

    // Construir URLs - usar formato simple y directo
    let successUrl = `${baseUrl}/subscription?status=success&tenant_id=${encodeURIComponent(tenant_id)}`;
    let failureUrl = `${baseUrl}/subscription?status=failure&tenant_id=${encodeURIComponent(tenant_id)}`;
    let pendingUrl = `${baseUrl}/subscription?status=pending&tenant_id=${encodeURIComponent(tenant_id)}`;

    // Si estamos en localhost, Mercado Pago no acepta estas URLs
    // Usar una URL pública temporal o quitar back_urls
    // Para testing, podemos usar una URL pública temporal o simplemente no usar back_urls
    if (isLocalhost) {
      // Opción 1: Usar una URL pública temporal (necesitarías configurar ngrok o similar)
      // Opción 2: No usar back_urls y el usuario volverá manualmente
      // Por ahora, usamos URLs de localhost pero sin auto_return
      console.warn('⚠️ Estás en localhost. Mercado Pago puede rechazar estas URLs. Considera usar ngrok para testing.');
    }

    // Validar que las URLs sean válidas
    try {
      new URL(successUrl);
      new URL(failureUrl);
      new URL(pendingUrl);
    } catch (e) {
      throw new Error(`URLs inválidas: ${e}`);
    }

    // En producción, esto debería hacerse en el backend
    // Por ahora, lo hacemos directamente desde el frontend para testing
    const preferenceData: any = {
      items: [
        {
          title: String(title),
          description: String(description),
          quantity: validatedQuantity,
          unit_price: validatedUnitPrice,
          currency_id: 'ARS',
        },
      ],
    };

    // Mercado Pago NO acepta URLs de localhost en back_urls
    // Si estamos en localhost, no agregamos back_urls ni auto_return
    // El usuario tendrá que volver manualmente después del pago
    if (isLocalhost) {
      // En localhost, NO usar back_urls porque Mercado Pago los rechaza
      // El usuario tendrá que volver manualmente a la aplicación después del pago
      console.warn('⚠️ Modo localhost: No se usarán back_urls. El usuario deberá volver manualmente después del pago.');
    } else {
      // En producción, usar back_urls con auto_return
      preferenceData.back_urls = {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      };
      preferenceData.auto_return = 'approved';
      preferenceData.notification_url = `${baseUrl}/api/mercadopago/webhook`;
    }

    preferenceData.metadata = {
      tenant_id: String(tenant_id),
      user_count: String(user_count),
      subscription_type: 'monthly',
    };

    console.log('Creating payment preference with data:', JSON.stringify(preferenceData, null, 2));
    console.log('URLs:', { successUrl, failureUrl, pendingUrl, isLocalhost, baseUrl });

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Mercado Pago API Error:', errorData);
      console.error('Response status:', response.status);
      console.error('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Extraer mensajes de error más detallados
      let errorMessage = 'Error al crear la preferencia de pago';
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.cause && Array.isArray(errorData.cause)) {
        const causes = errorData.cause.map((c: any) => c.description || c.message).join(', ');
        errorMessage = causes || errorMessage;
      }
      
      // Mensaje específico para errores de permisos
      if (errorMessage.includes('permiso') || errorMessage.includes('permission') || response.status === 403) {
        errorMessage = 'Error de permisos: La aplicación de Mercado Pago no tiene los permisos necesarios. ' +
          'Por favor, verifica en el panel de desarrolladores de Mercado Pago que la aplicación tenga ' +
          'habilitados los permisos para crear preferencias de pago.';
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return {
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    };
  } catch (error: any) {
    console.error('Error creating payment preference:', error);
    throw new Error(error.message || 'Error al crear la preferencia de pago');
  }
}

/**
 * Obtiene la public key de Mercado Pago
 */
export function getMercadoPagoPublicKey(): string {
  return MERCADO_PAGO_PUBLIC_KEY;
}

/**
 * Verifica el estado de un pago
 */
export async function getPaymentStatus(paymentId: string): Promise<any> {
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error('Error al obtener el estado del pago');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error getting payment status:', error);
    throw new Error(error.message || 'Error al obtener el estado del pago');
  }
}

