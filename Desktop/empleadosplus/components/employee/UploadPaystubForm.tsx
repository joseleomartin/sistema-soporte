'use client'

import { useState } from 'react'
import { uploadPaystub } from '@/lib/actions/paystub-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface UploadPaystubFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function UploadPaystubForm({
  open,
  onOpenChange,
  onSuccess,
}: UploadPaystubFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const fileInput = e.currentTarget.querySelector<HTMLInputElement>('input[type="file"]')
    const file = fileInput?.files?.[0]

    if (!file) {
      setError('Por favor selecciona un archivo PDF')
      setLoading(false)
      return
    }

    formData.append('file', file)

    const result = await uploadPaystub(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      onSuccess()
      onOpenChange(false)
      e.currentTarget.reset()
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir Recibo de Sueldo</DialogTitle>
          <DialogDescription>
            Sube un archivo PDF con tu recibo de sueldo. El costo es de $1.000 ARS por recibo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="period">Período del Recibo</Label>
              <Input
                id="period"
                name="period"
                type="date"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Archivo PDF</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept="application/pdf"
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Solo se permiten archivos PDF (máximo 10MB)
              </p>
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Subiendo...' : 'Subir Recibo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
