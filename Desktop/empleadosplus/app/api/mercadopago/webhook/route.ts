import { NextRequest, NextResponse } from 'next/server'
import { updateBillingStatus } from '@/lib/utils/mercadopago'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verificar que es una notificación de Mercado Pago
    if (!body.type || !body.data) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    const { type, data } = body

    // Solo procesar pagos aprobados
    if (type === 'payment') {
      const paymentId = data.id

      // Obtener información del pago desde Mercado Pago
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

      if (!accessToken) {
        return NextResponse.json({ error: 'MERCADOPAGO_ACCESS_TOKEN not configured' }, { status: 500 })
      }

      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!paymentResponse.ok) {
        return NextResponse.json({ error: 'Error fetching payment' }, { status: 500 })
      }

      const payment = await paymentResponse.json()

      // Determinar el estado según el estado del pago
      let status: 'pending' | 'paid' | 'failed' = 'pending'

      if (payment.status === 'approved') {
        status = 'paid'
      } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
        status = 'failed'
      } else if (payment.status === 'pending' || payment.status === 'in_process') {
        status = 'pending'
      }

      // Actualizar estado en la base de datos
      await updateBillingStatus(paymentId.toString(), status)

      return NextResponse.json({ received: true, status })
    }

    // Si no es un pago, solo confirmar recepción
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// También aceptar GET para verificación (Mercado Pago puede hacer GET)
export async function GET() {
  return NextResponse.json({ message: 'Webhook endpoint is active' })
}
