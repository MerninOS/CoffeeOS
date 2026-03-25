"use client";

import React from "react"
import Image from "next/image"

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Coffee, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isShopifyContext, setIsShopifyContext] = useState(false);
  const [nextPath, setNextPath] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const shop = params.get("shop");
    const host = params.get("host");

    if (next) setNextPath(next);

    // When shop + host params are present we're running inside the Shopify
    // admin iframe. Use App Bridge session tokens for seamless SSO instead of
    // showing the email/password form.
    if (shop && host) {
      setIsShopifyContext(true);
      setIsLoading(true);
      signInWithShopify(next || "/dashboard");
    }
  }, []);

  async function signInWithShopify(destination: string) {
    // Wait for App Bridge to initialise (loaded async from CDN)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let shopify = (window as any).shopify;
    const deadline = Date.now() + 5000;
    while (!shopify?.idToken && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shopify = (window as any).shopify;
    }

    if (!shopify?.idToken) {
      // App Bridge unavailable — fall back to the login form
      setIsShopifyContext(false);
      setIsLoading(false);
      return;
    }

    try {
      const sessionToken = await shopify.idToken();

      const res = await fetch("/api/shopify/session-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: sessionToken }),
      });

      if (!res.ok) {
        setIsShopifyContext(false);
        setIsLoading(false);
        return;
      }

      const { token_hash } = await res.json();
      const supabase = createClient();
      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        token_hash,
        type: "email",
      });

      if (otpError || !otpData.session) {
        setIsShopifyContext(false);
        setIsLoading(false);
        return;
      }

      // Exchange tokens via server so cookies are set with SameSite=None;
      // Secure — required for them to be sent in the Shopify admin iframe.
      await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: otpData.session.access_token,
          refresh_token: otpData.session.refresh_token,
        }),
      });

      // /api/shopify/* paths can redirect to external Shopify URLs (OAuth,
      // billing) which can't load in an iframe. Redirect the top frame instead.
      if (destination.startsWith("/api/shopify/") && window.top) {
        window.top.location.href = destination;
      } else {
        window.location.href = destination;
      }
    } catch {
      setIsShopifyContext(false);
      setIsLoading(false);
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    // Exchange tokens via server so cookies are set with SameSite=None;
    // Secure — required for them to be sent in the Shopify admin iframe.
    if (data.session) {
      await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      });
    }

    // /api/shopify/* paths can redirect to external Shopify URLs (OAuth,
    // billing) which can't load in an iframe. Redirect the top frame instead.
    if (nextPath.startsWith("/api/shopify/") && window.top) {
      window.top.location.href = nextPath;
    } else {
      window.location.href = nextPath;
    }
  };

  if (isShopifyContext) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Signing in with Shopify…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-4 flexitems-center justify-center">
            <Image alt={"coffee os logo"} width={250} height={100} src="/coffee_os_logo.png" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your CoffeeOS account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full px-0 mx-0" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href={nextPath !== "/dashboard" ? `/auth/sign-up?next=${encodeURIComponent(nextPath)}` : "/auth/sign-up"}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
