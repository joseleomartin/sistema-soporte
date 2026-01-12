'use server'

import { createClient } from '@/lib/supabase/server'
import { getBillingSummary } from '@/lib/actions/billing-actions'
import { createAdminClient } from '@/lib/supabase/admin'

// Nota: Mercado Pago SDK para Node.js
// En producción, instala: npm install mercadopago
// Para este ejemplo, usaremos la API REST directamente

export interface PaymentPreference {
  init_point?: string
  sandbox_init_point?: string
  id?: string
}

export async function createPaymentPreference(): Promise<PaymentPreference | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('No autorizado')
    }

    // Obtener facturación pendiente del mes actual
    const summaryResult = await getBillingSummary()
    if (summaryResult.error || !summaryResult.data) {
      throw new Error('Error al obtener facturación')
    }

    const summary = summaryResult.data

    // Si no hay recibos pendientes, no crear preferencia
    if (summary.pendingCount === 0) {
      return null
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurada')
    }

    // Obtener información del tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, full_name, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      throw new Error('Error al obtener perfil')
    }

    // Crear preferencia de pago
    const preferenceData = {
      items: [
        {
          title: `Facturación EmpleadosPlus - ${summary.pendingCount} recibos`,
          description: `Pago por ${summary.pendingCount} recibos de sueldo cargados (${summary.period})`,
          quantity: summary.pendingCount,
          unit_price: 1000.0,
          currency_id: 'ARS',
        },
      ],
      payer: {
        name: profile.full_name,
        email: profile.email,
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/billing?status=success`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/billing?status=failure`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/billing?status=pending`,
      },
      auto_return: 'approved',
      external_reference: `tenant_${profile.tenant_id}_${Date.now()}`,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mercadopago/webhook`,
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceData),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Error al crear preferencia: ${error}`)
    }

    const preference: PaymentPreference = await response.json()

    // Guardar referencia del pago en la base de datos (opcional, para tracking)
    // Esto se puede hacer en una tabla separada si se necesita

    return preference
  } catch (error) {
    console.error('Error al crear preferencia de Mercado Pago:', error)
    throw error
  }
}

export async function updateBillingStatus(
  paymentId: string,
  status: 'pending' | 'paid' | 'failed'
) {
  try {
    const adminClient = createAdminClient()

    // Obtener el período del mes actual
    const currentDate = new Date()
    const period = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`

    // Actualizar todos los registros pendientes del mes actual a pagados
    const { error } = await adminClient
      .from('billing_log')
      .update({
        status,
        mercadopago_payment_id: paymentId,
      })
      .eq('status', 'pending')
      .gte('period', period)
      .lt('period', new Date(new Date(period).setMonth(new Date(period).getMonth() + 1)).toISOString().slice(0, 10))

    if (error) {
      console.error('Error al actualizar estado de facturación:', error)
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error al actualizar estado:', error)
    return { success: false, error }
  }
}
