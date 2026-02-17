import { updateSession } from '@/lib/supabase/proxy'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/shopify/webhooks/')) {
    console.log('[shopify-webhook][middleware] incoming', {
      method: request.method,
      path: request.nextUrl.pathname,
      topic: request.headers.get('x-shopify-topic'),
      shop: request.headers.get('x-shopify-shop-domain'),
      webhookId: request.headers.get('x-shopify-webhook-id'),
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.next()
  }

  const response = await updateSession(request)
  const cspValue = "frame-ancestors 'self' https://admin.shopify.com https://*.myshopify.com;"

  response.headers.set('Content-Security-Policy', cspValue)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
