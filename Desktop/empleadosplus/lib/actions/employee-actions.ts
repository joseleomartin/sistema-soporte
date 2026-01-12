'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createEmployeeSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  fullName: z.string().min(1, 'El nombre es requerido'),
})

export async function createEmployeeAccount(formData: FormData) {
  try {
    // Validar que el usuario actual es admin
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'No autorizado' }
    }

    // Obtener perfil del admin
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !adminProfile) {
      return { error: 'Error al obtener perfil del administrador' }
    }

    if (adminProfile.role !== 'admin') {
      return { error: 'Solo los administradores pueden crear empleados' }
    }

    // Validar datos del formulario
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      fullName: formData.get('fullName') as string,
    }

    const validatedData = createEmployeeSchema.parse(rawData)

    // Usar Service Role Key para crear el usuario en auth.users
    const adminClient = createAdminClient()

    // Crear usuario en auth.users
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: validatedData.email,
        password: validatedData.password,
        email_confirm: true, // Confirmar email automáticamente
      })

    if (authError || !authData.user) {
      return { error: `Error al crear usuario: ${authError?.message}` }
    }

    // Crear perfil en la tabla profiles
    const { error: profileCreateError } = await adminClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        tenant_id: adminProfile.tenant_id,
        email: validatedData.email,
        role: 'employee',
        full_name: validatedData.fullName,
      })

    if (profileCreateError) {
      // Si falla la creación del perfil, eliminar el usuario de auth
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return {
        error: `Error al crear perfil: ${profileCreateError.message}`,
      }
    }

    revalidatePath('/admin/employees')
    return { success: true, userId: authData.user.id }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message }
    }
    return { error: 'Error inesperado al crear empleado' }
  }
}

export async function getEmployees() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'No autorizado', data: null }
    }

    // Obtener perfil del admin
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!adminProfile || adminProfile.role !== 'admin') {
      return { error: 'Solo los administradores pueden ver empleados', data: null }
    }

    // Obtener todos los empleados del tenant
    const { data: employees, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('tenant_id', adminProfile.tenant_id)
      .eq('role', 'employee')
      .order('created_at', { ascending: false })

    if (error) {
      return { error: error.message, data: null }
    }

    return { error: null, data: employees }
  } catch (error) {
    return { error: 'Error inesperado', data: null }
  }
}
