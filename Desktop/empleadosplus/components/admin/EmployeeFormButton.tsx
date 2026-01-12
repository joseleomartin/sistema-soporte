'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmployeeForm } from './EmployeeForm'

export function EmployeeFormButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Crear Empleado</Button>
      <EmployeeForm
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {
          window.location.reload()
        }}
      />
    </>
  )
}
