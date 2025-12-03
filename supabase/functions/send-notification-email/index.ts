// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'notificaciones@emagroup.com'

Deno.serve(async (req) => {
  try {
    // Verificar método
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parsear el payload que viene del trigger SQL
    const payload = await req.json()

    // Validar que tenemos el email del usuario
    if (!payload.user_email) {
      return new Response(
        JSON.stringify({ error: 'User email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Si no hay API key de Resend, retornar error pero no fallar
    if (!RESEND_API_KEY) {
      console.log('⚠️  RESEND_API_KEY no configurada. Notificación recibida pero email no enviado')
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Email service not configured',
          notification_received: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Construir el HTML del email
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">EmaGroup</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #111827; margin-top: 0; font-size: 20px;">${payload.title}</h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
            ${payload.message}
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              Puedes ver todas tus notificaciones en la plataforma EmaGroup.
            </p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <p style="color: #9ca3af; font-size: 12px;">
            Este es un email automático, por favor no respondas.
          </p>
        </div>
      </div>
    `

    // Enviar email usando Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: payload.user_email,
        subject: payload.title,
        html,
      }),
    })

    const data = await res.json()

    // Si hay error en la respuesta de Resend
    if (!res.ok) {
      console.error('Error enviando email con Resend:', data)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email',
          details: data,
          notification_received: true 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error en send-notification-email:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        notification_received: true 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
})

