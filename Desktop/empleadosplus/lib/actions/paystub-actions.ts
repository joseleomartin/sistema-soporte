'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const uploadPaystubSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
})

export async function uploadPaystub(formData: FormData) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'No autorizado' }
    }

    // Obtener perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return { error: 'Error al obtener perfil del usuario' }
    }

    // Solo empleados pueden subir recibos
    if (profile.role !== 'employee') {
      return { error: 'Solo los empleados pueden subir recibos' }
    }

    // Validar datos
    const period = formData.get('period') as string
    const file = formData.get('file') as File

    if (!file) {
      return { error: 'No se proporcionó ningún archivo' }
    }

    // Validar que sea PDF
    if (file.type !== 'application/pdf') {
      return { error: 'Solo se permiten archivos PDF' }
    }

    // Validar tamaño (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { error: 'El archivo no puede exceder 10MB' }
    }

    const validatedPeriod = uploadPaystubSchema.parse({ period })

    // Sanitizar nombre del archivo
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .toLowerCase()
    const fileExtension = sanitizedFileName.split('.').pop()
    const uniqueFileName = `${Date.now()}_${sanitizedFileName}`
    const filePath = `recibos/${profile.tenant_id}/${user.id}/${uniqueFileName}`

    // Subir archivo a Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('recibos')
      .upload(filePath, file, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      return { error: `Error al subir archivo: ${uploadError.message}` }
    }

    // Crear registro en paystubs
    const { data: paystubData, error: paystubError } = await supabase
      .from('paystubs')
      .insert({
        tenant_id: profile.tenant_id,
        employee_id: user.id,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        period: validatedPeriod.period,
      })
      .select()
      .single()

    if (paystubError || !paystubData) {
      // Si falla, eliminar archivo del storage
      await supabase.storage.from('recibos').remove([filePath])
      return { error: `Error al crear registro: ${paystubError?.message}` }
    }

    // Crear registro en billing_log usando Admin Client (para bypass RLS)
    const adminClient = createAdminClient()
    const billingPeriod = new Date(validatedPeriod.period)
    const billingPeriodFormatted = `${billingPeriod.getFullYear()}-${String(billingPeriod.getMonth() + 1).padStart(2, '0')}-01`

    const { error: billingError } = await adminClient
      .from('billing_log')
      .insert({
        tenant_id: profile.tenant_id,
        paystub_id: paystubData.id,
        amount: 1000.0,
        period: billingPeriodFormatted,
        status: 'pending',
      })

    if (billingError) {
      // Si falla el billing, no eliminamos el paystub ni el archivo
      // pero logueamos el error
      console.error('Error al crear registro de facturación:', billingError)
      // Continuamos ya que el recibo se subió correctamente
    }

    revalidatePath('/employee/paystubs')
    return { success: true, paystubId: paystubData.id }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message }
    }
    return { error: 'Error inesperado al subir recibo' }
  }
}

export async function getPaystubs() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'No autorizado', data: null }
    }

    // Obtener perfil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { error: 'Error al obtener perfil', data: null }
    }

    // Los empleados ven solo sus recibos, los admins ven todos del tenant
    const query = supabase
      .from('paystubs')
      .select('id, file_name, file_size, period, uploaded_at')
      .eq('tenant_id', profile.tenant_id)
      .order('uploaded_at', { ascending: false })

    if (profile.role === 'employee') {
      query.eq('employee_id', user.id)
    }

    const { data: paystubs, error } = await query

    if (error) {
      return { error: error.message, data: null }
    }

    return { error: null, data: paystubs }
  } catch (error) {
    return { error: 'Error inesperado', data: null }
  }
}

export async function getPaystubDownloadUrl(paystubId: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'No autorizado', url: null }
    }

    // Obtener información del recibo
    const { data: paystub, error: paystubError } = await supabase
      .from('paystubs')
      .select('file_path, employee_id, tenant_id')
      .eq('id', paystubId)
      .single()

    if (paystubError || !paystub) {
      return { error: 'Recibo no encontrado', url: null }
    }

    // Verificar permisos
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { error: 'Error al verificar permisos', url: null }
    }

    const canAccess =
      profile.tenant_id === paystub.tenant_id &&
      (profile.role === 'admin' || paystub.employee_id === user.id)

    if (!canAccess) {
      return { error: 'No tienes permiso para descargar este recibo', url: null }
    }

    // Generar URL firmada (válida por 1 hora)
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from('recibos')
        .createSignedUrl(paystub.file_path, 3600)

    if (signedUrlError || !signedUrlData) {
      return { error: 'Error al generar URL de descarga', url: null }
    }

    return { error: null, url: signedUrlData.signedUrl }
  } catch (error) {
    return { error: 'Error inesperado', url: null }
  }
}
