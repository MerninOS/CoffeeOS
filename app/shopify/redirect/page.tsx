"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Intermediary page for external Shopify redirects (OAuth, billing/plan pages).
 *
 * Server-side HTTP redirects to external Shopify URLs crash when the app is
 * running inside the Shopify admin iframe because those pages block framing.
 * Instead of redirecting directly, server routes redirect here first. This
 * page then uses window.top to push the navigation to the parent frame,
 * breaking out of the iframe cleanly.
 */
export default function ShopifyRedirectPage() {
  useEffect(() => {
    const url = new URLSearchParams(window.location.search).get("url");
    if (!url) return;

    try {
      // Validate it's a safe absolute URL before redirecting
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") return;

      (window.top || window).location.href = url;
    } catch {
      // Invalid URL — do nothing
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Redirecting to Shopify…</p>
      </div>
    </div>
  );
}
