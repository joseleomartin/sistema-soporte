'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { UploadPaystubForm } from './UploadPaystubForm'

export function UploadButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Subir Recibo</Button>
      <UploadPaystubForm
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {
          window.location.reload()
        }}
      />
    </>
  )
}
