import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Rutas públicas
  if (pathname === '/login' || pathname === '/') {
    if (user) {
      // Si ya está autenticado, obtener su rol y redirigir
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'admin') {
        return NextResponse.redirect(new URL('/admin/employees', request.url))
      } else if (profile?.role === 'employee') {
        return NextResponse.redirect(new URL('/employee/paystubs', request.url))
      }
    }
    return supabaseResponse
  }

  // Rutas protegidas: requiere autenticación
  if (pathname.startsWith('/admin') || pathname.startsWith('/employee')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Obtener perfil del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Proteger rutas de admin
    if (pathname.startsWith('/admin')) {
      if (profile.role !== 'admin') {
        return NextResponse.redirect(new URL('/employee/paystubs', request.url))
      }
    }

    // Proteger rutas de employee
    if (pathname.startsWith('/employee')) {
      if (profile.role !== 'employee') {
        return NextResponse.redirect(new URL('/admin/employees', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
