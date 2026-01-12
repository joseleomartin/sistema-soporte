'use server'

import { createClient } from '@/lib/supabase/server'

export async function getBillingSummary(period?: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'No autorizado', data: null }
    }

    // Verificar que sea admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return { error: 'Solo los administradores pueden ver la facturación', data: null }
    }

    // Si no se especifica periodo, usar el mes actual
    const targetPeriod = period || new Date().toISOString().slice(0, 7) + '-01'

    // Obtener todos los registros de facturación del periodo
    const { data: billingRecords, error: billingError } = await supabase
      .from('billing_log')
      .select('id, amount, status, created_at, paystub_id')
      .eq('tenant_id', profile.tenant_id)
      .gte('period', targetPeriod)
      .lt('period', new Date(new Date(targetPeriod).setMonth(new Date(targetPeriod).getMonth() + 1)).toISOString().slice(0, 10))
      .order('created_at', { ascending: false })

    if (billingError) {
      return { error: billingError.message, data: null }
    }

    // Calcular resumen
    const total = billingRecords?.length || 0
    const totalAmount = (billingRecords?.reduce((sum, record) => sum + Number(record.amount), 0) || 0)
    const pendingCount = billingRecords?.filter(r => r.status === 'pending').length || 0
    const paidCount = billingRecords?.filter(r => r.status === 'paid').length || 0
    const failedCount = billingRecords?.filter(r => r.status === 'failed').length || 0

    const summary = {
      total,
      totalAmount,
      pendingCount,
      paidCount,
      failedCount,
      records: billingRecords || [],
      period: targetPeriod,
    }

    return { error: null, data: summary }
  } catch (error) {
    return { error: 'Error inesperado al obtener resumen de facturación', data: null }
  }
}

export async function getBillingHistory(limit: number = 50) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'No autorizado', data: null }
    }

    // Verificar que sea admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return { error: 'Solo los administradores pueden ver la facturación', data: null }
    }

    // Obtener historial completo
    const { data: billingHistory, error } = await supabase
      .from('billing_log')
      .select(`
        id,
        amount,
        status,
        period,
        created_at,
        mercadopago_payment_id,
        paystubs (
          file_name,
          period
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return { error: error.message, data: null }
    }

    return { error: null, data: billingHistory }
  } catch (error) {
    return { error: 'Error inesperado', data: null }
  }
}
