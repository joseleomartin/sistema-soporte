// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL_ADDRESS = Deno.env.get('FROM_EMAIL') || 'notificaciones@app.somosemagroup.com'
const FROM_NAME = 'EmaGroup Notificaciones'
const FROM_EMAIL = `${FROM_NAME} <${FROM_EMAIL_ADDRESS}>`
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://app.somosemagroup.com'

Deno.serve(async (req) => {
  const payload = await req.json()
  
  console.log('📥 Payload recibido:', JSON.stringify(payload, null, 2))
  
  // El webhook de Supabase envía: { type, table, record, ... }
  let to = null
  let subject = ''
  let message = ''
  let html = ''
  
  // Si viene desde webhook de Supabase con el record completo
  if (payload.record) {
    const record = payload.record
    
    // Obtener email del usuario desde Supabase
    // Necesitamos hacer una query a la base de datos
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://yevbgutnuoivcuqnmrzi.supabase.co'
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (record.user_id && supabaseServiceKey) {
      // Obtener email del usuario usando la API de Supabase
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${record.user_id}&select=email,full_name`,
        {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (profileResponse.ok) {
        const profiles = await profileResponse.json()
        if (profiles && profiles.length > 0) {
          to = profiles[0].email
        }
      }
    }
    
    // Obtener datos de la notificación
    // Agregar "EmaGroup Notificaciones:" solo para el email, no para la notificación en la app
    const notificationTitle = record.title || 'Notificación'
    subject = notificationTitle.startsWith('EmaGroup Notificaciones:') 
      ? notificationTitle 
      : `EmaGroup Notificaciones: ${notificationTitle}`
    message = record.message || ''
    
    // Limpiar menciones del formato técnico @[Nombre](user_id) a @Nombre
    message = message.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
    
    // Construir URL de redirección - solo la URL base sin hash
    let redirectUrl = FRONTEND_URL
    
    // Log para depuración
    console.log('🔍 Tipo de notificación:', record.type)
    console.log('🔍 Ticket ID:', record.ticket_id)
    console.log('🔍 Record completo:', JSON.stringify(record, null, 2))
    
    // Verificar si es un recordatorio de horas para personalizar el botón
    const isHoursReminder = record.metadata?.is_hours_reminder === true || record.metadata?.is_hours_reminder === 'true'
    
    // Si es un evento de calendario, agregar parámetro para abrir el modal del calendario
    const isCalendarEvent = record.type === 'calendar_event'
    if (isCalendarEvent) {
      redirectUrl = `${FRONTEND_URL}?openCalendar=true`
      console.log('✅ Redirigiendo a calendario:', redirectUrl)
    }
    
    // Si es un ticket (ticket_created, ticket_comment, ticket_status), agregar parámetro para navegar al ticket
    const isTicketNotification = record.type === 'ticket_created' || record.type === 'ticket_comment' || record.type === 'ticket_status'
    if (isTicketNotification) {
      // Intentar obtener ticket_id de diferentes formas posibles
      const ticketId = record.ticket_id || record.ticketId || (record.metadata && record.metadata.ticket_id)
      
      if (ticketId) {
        redirectUrl = `${FRONTEND_URL}?ticketId=${ticketId}`
        console.log('✅ Redirigiendo a ticket:', redirectUrl)
      } else {
        console.log('⚠️ Es una notificación de ticket pero no se encontró ticket_id')
      }
    }
    
    const buttonText = isHoursReminder ? 'Ir a Cargar Horas' : 'Ir a la plataforma'
    const buttonHelpText = isHoursReminder 
      ? 'Haz clic en el botón para ir directamente a la sección de carga de horas.'
      : 'Puedes ver todas tus notificaciones en la plataforma EmaGroup.'
    
    // Construir HTML
    if (message) {
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">EmaGroup</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #111827; margin-top: 0; font-size: 20px;">${subject}</h2>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">${message}</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <a href="${redirectUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 10px 0;">${buttonText}</a>
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">${buttonHelpText}</p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 12px;">Este es un email automático, por favor no respondas.</p>
          </div>
        </div>
      `
    }
  } else {
    // Si viene formato directo (desde trigger o test manual)
    to = payload.to
    // Para vencimientos, no agregar el prefijo "EmaGroup Notificaciones:"
    const notificationSubject = payload.subject || 'Notificación'
    // Solo agregar el prefijo si NO es un email de vencimientos
    if (notificationSubject.startsWith('Vencimientos -')) {
      subject = notificationSubject
    } else {
      subject = notificationSubject.startsWith('EmaGroup Notificaciones:') 
        ? notificationSubject 
        : `EmaGroup Notificaciones: ${notificationSubject}`
    }
    html = payload.html
    message = payload.message
    
    // Limpiar menciones del formato técnico @[Nombre](user_id) a @Nombre
    if (message) {
      message = message.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
    }
    
    // Construir URL de redirección - solo la URL base sin hash
    const redirectUrl = payload.redirect_url || FRONTEND_URL
    
    // Si no hay HTML pero hay message, construir HTML
    if (!html && message) {
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">EmaGroup</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #111827; margin-top: 0; font-size: 20px;">${subject}</h2>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">${message}</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <a href="${redirectUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 10px 0;">Ir a la plataforma</a>
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">Puedes ver todas tus notificaciones en la plataforma EmaGroup.</p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 12px;">Este es un email automático, por favor no respondas.</p>
          </div>
        </div>
      `
    }
  }

  // Validar que tenemos los campos requeridos
  if (!to || !subject || !html) {
    console.error('❌ Campos faltantes:', { to, subject, html: !!html, payload })
    return new Response(
      JSON.stringify({ 
        error: 'Missing required fields: to, subject, html',
        received: { to, subject, hasHtml: !!html }
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Si no hay API key, retornar error
  if (!RESEND_API_KEY) {
    console.error('⚠️  RESEND_API_KEY no configurada')
    return new Response(
      JSON.stringify({ 
        error: 'RESEND_API_KEY not configured',
        message: 'Configure RESEND_API_KEY in Edge Function settings'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Enviar email usando Resend con retry logic para manejar rate limiting
  const maxRetries = 3
  let retryCount = 0
  let lastError = null
  
  while (retryCount < maxRetries) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    })

    const data = await res.json()

    // Si es éxito, retornar
    if (res.ok) {
      console.log('✅ Email enviado exitosamente a:', to)
      return new Response(
        JSON.stringify(data),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Si es error 429 (rate limit), esperar y reintentar
    if (res.status === 429 && retryCount < maxRetries - 1) {
      const retryAfter = res.headers.get('retry-after') || '1'
      const waitTime = parseInt(retryAfter) * 1000 || 1000 // Esperar al menos 1 segundo
      
      console.log(`⏳ Rate limit alcanzado. Esperando ${waitTime}ms antes de reintentar... (intento ${retryCount + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      retryCount++
      lastError = data
      continue
    }

    // Si es otro error o se agotaron los reintentos, retornar error
    console.error('❌ Error enviando email con Resend:', data)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send email',
        details: data,
        retries: retryCount
      }),
      { status: res.status, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Si llegamos aquí, se agotaron los reintentos
  console.error('❌ Error enviando email después de', maxRetries, 'intentos:', lastError)
  return new Response(
    JSON.stringify({ 
      error: 'Failed to send email after retries',
      details: lastError
    }),
    { status: 429, headers: { 'Content-Type': 'application/json' } }
  )
})





