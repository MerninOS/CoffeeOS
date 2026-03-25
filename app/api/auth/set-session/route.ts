import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * Exchanges a valid Supabase session (access_token + refresh_token) for
 * HTTP-only cookies set with SameSite=None; Secure so they are included in
 * requests made from within the Shopify admin iframe.
 *
 * Calling supabase.auth.setSession() client-side in an embedded context fails
 * because browsers treat document.cookie writes as third-party (blocked by
 * Safari ITP and Chrome's cookie restrictions). Setting them via a server
 * HTTP response bypasses that restriction.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { access_token, refresh_token } = body ?? {};

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              // SameSite=None is required for cookies to be sent in
              // cross-site iframe contexts (Shopify admin embeds our app).
              sameSite: "none",
              secure: true,
            });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  return response;
}
