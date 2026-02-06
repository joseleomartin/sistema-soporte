// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ExcelRow {
  [key: string]: any
}

Deno.serve(async (req) => {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  try {
    // Obtener el token de autenticación
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No se proporcionó token de autenticación' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Inicializar cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Obtener tenant_id del usuario
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No se pudo obtener el tenant del usuario' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Obtener los datos del body (JSON con datos procesados del Excel)
    let body
    try {
      body = await req.json()
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Error al parsear el cuerpo de la petición. Asegúrate de enviar JSON válido.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    const { hojas } = body

    if (!hojas || typeof hojas !== 'object') {
      return new Response(
        JSON.stringify({ error: 'No se proporcionaron datos de vencimientos. El formato debe ser: { hojas: { [nombreHoja]: [filas] } }' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Limpiar vencimientos anteriores del tenant antes de insertar nuevos
    const { error: deleteError } = await supabase
      .from('vencimientos')
      .delete()
      .eq('tenant_id', profile.tenant_id)

    if (deleteError) {
      console.error('Error eliminando vencimientos anteriores:', deleteError)
      // Continuar de todas formas, puede que no haya vencimientos anteriores
    }

    // Insertar vencimientos por hoja
    const resultados: { [hoja: string]: { insertados: number, errores: number } } = {}
    let totalInsertados = 0
    let totalErrores = 0

    for (const [hojaNombre, filas] of Object.entries(hojas)) {
      if (!Array.isArray(filas)) {
        console.error(`La hoja "${hojaNombre}" no contiene un array de filas`)
        resultados[hojaNombre] = { insertados: 0, errores: 1 }
        totalErrores++
        continue
      }

      // Preparar datos para inserción
      const datosParaInsertar = filas.map((fila: ExcelRow) => ({
        tenant_id: profile.tenant_id,
        hoja_nombre: hojaNombre,
        datos: fila, // Almacenar toda la fila como JSONB
      }))

      // Insertar en lotes de 1000 para evitar problemas de tamaño
      const batchSize = 1000
      let insertados = 0
      let errores = 0

      for (let i = 0; i < datosParaInsertar.length; i += batchSize) {
        const batch = datosParaInsertar.slice(i, i + batchSize)
        
        const { data, error: insertError } = await supabase
          .from('vencimientos')
          .insert(batch)
          .select('id')

        if (insertError) {
          console.error(`Error insertando lote de ${hojaNombre}:`, insertError)
          errores += batch.length
        } else {
          insertados += data?.length || batch.length
        }
      }

      resultados[hojaNombre] = { insertados, errores }
      totalInsertados += insertados
      totalErrores += errores
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Vencimientos cargados exitosamente`,
        resultados,
        total: {
          insertados: totalInsertados,
          errores: totalErrores,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error en upload-vencimientos:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
