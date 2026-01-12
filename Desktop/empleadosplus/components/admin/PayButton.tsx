'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createPaymentPreference } from '@/lib/actions/payment-actions'

export function PayButton() {
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    setLoading(true)
    try {
      const result = await createPaymentPreference()
      if (result.error) {
        alert(result.error)
        return
      }
      if (result.preference?.init_point) {
        window.location.href = result.preference.init_point
      } else if (result.preference?.sandbox_init_point) {
        window.location.href = result.preference.sandbox_init_point
      }
    } catch (error) {
      console.error('Error al crear preferencia de pago:', error)
      alert('Error al procesar el pago. Por favor, intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handlePay} disabled={loading}>
      {loading ? 'Procesando...' : 'Pagar Facturación'}
    </Button>
  )
}
