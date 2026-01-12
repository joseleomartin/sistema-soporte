'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getPaystubDownloadUrl } from '@/lib/actions/paystub-actions'

interface DownloadButtonProps {
  paystubId: string
  fileName: string
}

export function DownloadButton({ paystubId, fileName }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const result = await getPaystubDownloadUrl(paystubId)
      if (result.error) {
        alert(result.error)
        return
      }
      if (result.url) {
        // Crear un enlace temporal para descargar
        const link = document.createElement('a')
        link.href = result.url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (error) {
      console.error('Error al descargar:', error)
      alert('Error al descargar el archivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleDownload} disabled={loading} variant="outline" size="sm">
      {loading ? 'Descargando...' : 'Descargar'}
    </Button>
  )
}
