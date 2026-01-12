import { getPaystubs } from '@/lib/actions/paystub-actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { DownloadButton } from './DownloadButton'

export async function PaystubsTable() {
  const { data: paystubs, error } = await getPaystubs()

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!paystubs || paystubs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No hay recibos cargados aún.</p>
        </CardContent>
      </Card>
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis Recibos de Sueldo</CardTitle>
        <CardDescription>
          Historial de todos tus recibos de sueldo cargados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Archivo</TableHead>
              <TableHead>Tamaño</TableHead>
              <TableHead>Fecha de Carga</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paystubs.map((paystub) => (
              <TableRow key={paystub.id}>
                <TableCell className="font-medium">
                  {format(new Date(paystub.period), "MMMM yyyy")}
                </TableCell>
                <TableCell>{paystub.file_name}</TableCell>
                <TableCell>{formatFileSize(paystub.file_size)}</TableCell>
                <TableCell>
                  {format(new Date(paystub.uploaded_at), "dd/MM/yyyy HH:mm")}
                </TableCell>
                <TableCell>
                  <DownloadButton paystubId={paystub.id} fileName={paystub.file_name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
