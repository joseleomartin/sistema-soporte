import { BillingDashboard } from '@/components/admin/BillingDashboard'
import { PayButton } from '@/components/admin/PayButton'

export default async function BillingPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Facturación</h2>
          <p className="text-muted-foreground">
            Gestiona la facturación de recibos de sueldo. $1.000 ARS por recibo cargado.
          </p>
        </div>
        <PayButton />
      </div>
      <BillingDashboard />
    </div>
  )
}
