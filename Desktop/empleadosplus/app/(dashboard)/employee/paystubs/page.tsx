import { PaystubsTable } from '@/components/employee/PaystubsTable'
import { UploadButton } from '@/components/employee/UploadButton'

export default async function PaystubsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mis Recibos de Sueldo</h2>
          <p className="text-muted-foreground">
            Gestiona y descarga tus recibos de sueldo
          </p>
        </div>
        <UploadButton />
      </div>
      <PaystubsTable />
    </div>
  )
}
