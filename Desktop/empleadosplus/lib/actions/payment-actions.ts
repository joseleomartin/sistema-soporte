'use server'

import { createPaymentPreference as createMPPreference } from '@/lib/utils/mercadopago'

export async function createPaymentPreference() {
  try {
    const preference = await createMPPreference()
    if (!preference) {
      return { error: 'No hay facturación pendiente', preference: null }
    }
    return { error: null, preference }
  } catch (error: any) {
    return { error: error.message || 'Error al crear preferencia de pago', preference: null }
  }
}
