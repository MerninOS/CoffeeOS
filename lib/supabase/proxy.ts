import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasBillingAccess, hasShopifyConnectionAccess } from '@/lib/shopify-billing'
import { createAdminClient } from '@/lib/supabase/admin'

export async function updateSession(request: NextRequest) {
  console.log("[shopify-flow][proxy] request", {
    path: request.nextUrl.pathname,
  })
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes that require authentication
  const protectedPaths = ['/dashboard', '/products', '/components', '/settings']
  const billingProtectedPaths = ['/dashboard', '/products', '/components', '/orders', '/inventory', '/roasting']
  const isProtectedRoute = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )
  const isBillingProtectedRoute = billingProtectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedRoute && !user) {
    console.log("[shopify-flow][proxy] redirect auth required", {
      path: request.nextUrl.pathname,
    })
    // no user, redirect to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged in users away from auth pages
  const authPaths = ['/auth/login', '/auth/sign-up']
  const isAuthRoute = authPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (isAuthRoute && user) {
    console.log("[shopify-flow][proxy] redirect authed user away from auth", {
      path: request.nextUrl.pathname,
      userId: user.id,
    })
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Enforce Shopify connection + active billing for core app pages.
  // Keep /settings accessible so owners can connect Shopify and approve billing.
  if (user && isBillingProtectedRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, owner_id")
      .eq("id", user.id)
      .single()

    const ownerId = profile?.role === "owner" ? user.id : profile?.owner_id || user.id

    const { data: settings, error: settingsError } = await supabase
      .from("shopify_settings")
      .select("*")
      .eq("user_id", ownerId)
      .maybeSingle()

    if (settingsError) {
      console.log("[shopify-flow][proxy] user-scoped settings query error", {
        ownerId,
        error: settingsError.message,
      })
    }

    let resolvedSettings = settings
    if (!resolvedSettings) {
      try {
        const supabaseAdmin = createAdminClient()
        const { data: adminSettings, error: adminSettingsError } = await supabaseAdmin
          .from("shopify_settings")
          .select("*")
          .eq("user_id", ownerId)
          .maybeSingle()

        if (adminSettingsError) {
          console.log("[shopify-flow][proxy] admin fallback settings query error", {
            ownerId,
            error: adminSettingsError.message,
          })
        } else if (adminSettings) {
          resolvedSettings = adminSettings
          console.log("[shopify-flow][proxy] using admin fallback settings", {
            ownerId,
            connectedViaOauth: !!adminSettings.connected_via_oauth,
            hasAdminToken: !!adminSettings.admin_access_token,
            billingStatus: (adminSettings as { billing_status?: string | null }).billing_status || null,
          })
        }
      } catch (adminError) {
        console.log("[shopify-flow][proxy] admin fallback failed", {
          ownerId,
          error: adminError instanceof Error ? adminError.message : "unknown_error",
        })
      }
    }

    const isConnected = !!(resolvedSettings?.connected_via_oauth && resolvedSettings?.admin_access_token)
    const billingStatus = (resolvedSettings as { billing_status?: string | null } | null)?.billing_status || null
    const hasBilling = hasBillingAccess(billingStatus, user.email)
    const hasConnectionAccess = hasShopifyConnectionAccess(isConnected, user.email)
    console.log("[shopify-flow][proxy] billing gate evaluation", {
      path: request.nextUrl.pathname,
      userId: user.id,
      userEmail: user.email,
      role: profile?.role || null,
      ownerId,
      connectedViaOauth: !!resolvedSettings?.connected_via_oauth,
      hasAdminToken: !!resolvedSettings?.admin_access_token,
      billingStatus,
      isConnected,
      hasConnectionAccess,
      hasBilling,
    })

    if (!hasConnectionAccess || !hasBilling) {
      const url = request.nextUrl.clone()
      url.pathname = "/settings"
      url.searchParams.set("error", !hasConnectionAccess ? "shopify_not_connected" : "billing_not_active")
      if (hasConnectionAccess && !hasBilling && resolvedSettings?.admin_access_token) {
        url.searchParams.set("action", "activate_billing")
      }
      console.log("[shopify-flow][proxy] redirect settings due to gate", {
        fromPath: request.nextUrl.pathname,
        error: !hasConnectionAccess ? "shopify_not_connected" : "billing_not_active",
        hasConnectionAccess,
        hasBilling,
      })
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
