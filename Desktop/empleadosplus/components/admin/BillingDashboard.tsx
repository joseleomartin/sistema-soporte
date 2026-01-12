import { getBillingSummary, getBillingHistory } from '@/lib/actions/billing-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'

export async function BillingDashboard() {
  const summaryResult = await getBillingSummary()
  const historyResult = await getBillingHistory(20)

  if (summaryResult.error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {summaryResult.error}</p>
        </CardContent>
      </Card>
    )
  }

  const summary = summaryResult.data!
  const history = historyResult.data || []

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: {
        label: 'Pendiente',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      },
      paid: {
        label: 'Pagado',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      },
      failed: {
        label: 'Fallido',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      },
    }

    const variant = variants[status] || variants.pending

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variant.className}`}
      >
        {variant.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recibos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {summary.total} recibos × $1.000
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.paidCount}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(summary.paidCount * 1000)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(summary.pendingCount * 1000)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Facturación</CardTitle>
          <CardDescription>
            Últimos registros de facturación por recibo cargado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground">No hay registros de facturación aún.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Recibo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record: any) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(new Date(record.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {record.paystubs?.file_name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.period), "MMMM yyyy")}
                    </TableCell>
                    <TableCell>{formatCurrency(Number(record.amount))}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
