// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'notificaciones@app.somosemagroup.com'
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
    subject = record.title || 'Notificación'
    message = record.message || ''
    
    // Limpiar menciones del formato técnico @[Nombre](user_id) a @Nombre
    message = message.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
    
    // Construir URL de redirección según el tipo de notificación
    let redirectUrl = `${FRONTEND_URL}/#notifications`
    if (record.type === 'task_mention' && record.task_id) {
      redirectUrl = `${FRONTEND_URL}/#tasks?task=${record.task_id}`
    } else if (record.type === 'direct_message') {
      redirectUrl = `${FRONTEND_URL}/#messages`
    } else if (record.type === 'ticket_comment' || record.type === 'ticket_status') {
      redirectUrl = `${FRONTEND_URL}/#tickets`
    } else if (record.type === 'calendar_event') {
      redirectUrl = `${FRONTEND_URL}/#calendar`
    } else if (record.type === 'task_assigned') {
      redirectUrl = `${FRONTEND_URL}/#tasks`
    } else if (record.type === 'forum_mention') {
      redirectUrl = `${FRONTEND_URL}/#forum`
    }
    
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
  } else {
    // Si viene formato directo (desde trigger o test manual)
    to = payload.to
    subject = payload.subject
    html = payload.html
    message = payload.message
    
    // Limpiar menciones del formato técnico @[Nombre](user_id) a @Nombre
    if (message) {
      message = message.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
    }
    
    // Construir URL de redirección (formato directo, usar notificaciones por defecto)
    const redirectUrl = payload.redirect_url || `${FRONTEND_URL}/#notifications`
    
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

  // Enviar email usando Resend
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,  // Usar FROM_EMAIL de las variables de entorno
      to,
      subject,
      html,
    }),
  })

  const data = await res.json()

  // Si hay error, loguearlo
  if (!res.ok) {
    console.error('❌ Error enviando email con Resend:', data)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send email',
        details: data
      }),
      { status: res.status, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Éxito
  console.log('✅ Email enviado exitosamente a:', to)
  return new Response(
    JSON.stringify(data),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

