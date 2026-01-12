import { EmployeesTable } from '@/components/admin/EmployeesTable'
import { EmployeeFormButton } from '@/components/admin/EmployeeFormButton'

export default async function EmployeesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Empleados</h2>
          <p className="text-muted-foreground">
            Administra los empleados de tu organización
          </p>
        </div>
        <EmployeeFormButton />
      </div>
      <EmployeesTable />
    </div>
  )
}
